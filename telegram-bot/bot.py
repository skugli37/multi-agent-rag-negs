import telebot
import os

# Token iz environment varijable ili direktan unos
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8788479325:AAGRz51532YwYNyU9zZVkyssv8srZT0ctnI")
bot = telebot.TeleBot(TOKEN)

@bot.message_handler(commands=["start"])
def start(message):
    bot.send_message(message.chat.id, "🤖 Zdravo! Ja sam Telegram bot kreiran od strane NEGS agenta!")

@bot.message_handler(commands=["help"])
def help_cmd(message):
    bot.send_message(message.chat.id, "Komande: /start, /help, ili pošalji poruku")

@bot.message_handler(func=lambda m: True)
def echo_all(message):
    bot.send_message(message.chat.id, f"Primio: {message.text}")

print("🚀 Bot pokrenut! Pritisni Ctrl+C za prekid.")
bot.polling()
