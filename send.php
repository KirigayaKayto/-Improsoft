<?php
/* ============================================================
   Improsoft — приём заявок с формы и отправка в Telegram.
   Требует рядом файл tg-config.php с $TG_TOKEN и $TG_CHAT_ID
   (см. tg-config.example.php).
   ============================================================ */

header("X-Content-Type-Options: nosniff");

$isAjax = isset($_SERVER["HTTP_X_REQUESTED_WITH"])
       && $_SERVER["HTTP_X_REQUESTED_WITH"] === "fetch";

function respond($ok, $isAjax) {
  if ($isAjax) {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(array("ok" => (bool)$ok));
  } else {
    header("Content-Type: text/html; charset=utf-8");
    $msg = $ok
      ? "Заявка получена — мы свяжемся с вами. / So'rov qabul qilindi — siz bilan bog'lanamiz."
      : "Не получилось отправить заявку. Напишите нам в Telegram: @improsoftsupport";
    echo "<!DOCTYPE html><html lang=\"ru\"><head><meta charset=\"utf-8\">"
       . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
       . "<title>Improsoft</title></head>"
       . "<body style=\"font-family:sans-serif;display:flex;min-height:100vh;align-items:center;"
       . "justify-content:center;background:#f6f8f4;color:#363435\">"
       . "<p style=\"max-width:32em;text-align:center;line-height:1.6\">" . $msg
       . "<br><br><a href=\"./\" style=\"color:#407d5b\">&larr; Вернуться на сайт</a></p>"
       . "</body></html>";
  }
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  respond(false, $isAjax);
}

$configPath = __DIR__ . "/tg-config.php";
if (!file_exists($configPath)) {
  http_response_code(500);
  respond(false, $isAjax);
}
require $configPath; // задаёт $TG_TOKEN и $TG_CHAT_ID

/* honeypot: скрытое поле, которое заполняют только боты — тихо делаем вид, что всё ок */
if (!empty($_POST["website"])) {
  respond(true, $isAjax);
}

/* троттлинг: не чаще одной заявки в 15 секунд с одного IP */
$ip = isset($_SERVER["REMOTE_ADDR"]) ? $_SERVER["REMOTE_ADDR"] : "0";
$stamp = sys_get_temp_dir() . "/improsoft-lead-" . md5($ip);
if (file_exists($stamp) && (time() - filemtime($stamp)) < 15) {
  respond(true, $isAjax);
}
@touch($stamp);

function fieldClean($key, $max) {
  $v = isset($_POST[$key]) ? trim((string)$_POST[$key]) : "";
  if (function_exists("mb_substr")) {
    $v = mb_substr($v, 0, $max, "UTF-8");
  } else {
    $v = substr($v, 0, $max * 4);
  }
  return htmlspecialchars($v, ENT_QUOTES, "UTF-8");
}

$name     = fieldClean("name", 100);
$phone    = fieldClean("phone", 30);
$business = fieldClean("business", 30);
$message  = fieldClean("message", 1000);
$lang     = fieldClean("lang", 5);

if ($name === "" || $phone === "") {
  http_response_code(422);
  respond(false, $isAjax);
}

$bizNames = array(
  "cafe"   => "Кафе / ресторан",
  "market" => "Магазин",
  "pharm"  => "Аптека",
  "other"  => "Другое",
);
$bizLabel = isset($bizNames[$business]) ? $bizNames[$business] : $business;

$text = "🔔 <b>Заявка с сайта Improsoft</b>\n"
      . "👤 Имя: " . $name . "\n"
      . "📞 Телефон: " . $phone . "\n"
      . "🏪 Бизнес: " . $bizLabel . "\n"
      . ($message !== "" ? "💬 Сообщение: " . $message . "\n" : "")
      . "🌐 Язык страницы: " . ($lang !== "" ? $lang : "ru");

$url = "https://api.telegram.org/bot" . $TG_TOKEN . "/sendMessage";
$payload = array(
  "chat_id"    => $TG_CHAT_ID,
  "text"       => $text,
  "parse_mode" => "HTML",
);

$ok = false;
if (function_exists("curl_init")) {
  $ch = curl_init($url);
  curl_setopt_array($ch, array(
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query($payload),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
  ));
  $res = curl_exec($ch);
  curl_close($ch);
  $ok = ($res !== false) && (strpos($res, '"ok":true') !== false);
} else {
  /* запасной путь, если curl на хостинге выключен */
  $ctx = stream_context_create(array("http" => array(
    "method"  => "POST",
    "header"  => "Content-Type: application/x-www-form-urlencoded\r\n",
    "content" => http_build_query($payload),
    "timeout" => 10,
  )));
  $res = @file_get_contents($url, false, $ctx);
  $ok = ($res !== false) && (strpos($res, '"ok":true') !== false);
}

if (!$ok) {
  http_response_code(502);
}
respond($ok, $isAjax);
