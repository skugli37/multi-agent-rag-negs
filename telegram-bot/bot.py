import telebot
import os

TOKEN = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890"
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

print("🚀 Bot pokrenut!")
bot.polling()

