
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./firebase-key.json");
const http = require("http");
const PORT = process.env.PORT || 3000;
const token = process.env.BOT_TOKEN;          // Telegram Bot Token
const api_url = process.env.API_URL;          // Open-Meteo API base URL

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const bot = new TelegramBot(token, { polling: true });
async function getWeather(latitude, longitude) {
  try {
    const params = {
      latitude,
      longitude,
      current_weather: true,
    };

    const response = await axios.get(api_url, { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching weather:", error.message);
    throw new Error("Failed to fetch weather data");
  }
}

function formatWeatherResponse(weatherData) {
  if (!weatherData || !weatherData.current_weather) {
    throw new Error("Invalid weather data");
  }

  const { temperature, weathercode, windspeed } = weatherData.current_weather;

  return (
    `🌤️ *Current Weather Report*\n` +
    `\n🌡️ Temperature: *${temperature}°C*` +
    `\n🌬️ Wind Speed: *${windspeed} km/h*` +
    `\n☁️ Weather Code: *${weathercode}*`
  );
}

console.log("🤖 Telegram Weather Bot is running...");

bot.onText(/\/start/, (msg) => {
  const welcomeMsg =
    `👋 Hello *${msg.from.first_name || "User"}*!\n\n` +
    `I can show you the current weather for any location.\n` +
    `Use the following format:\n\n` +
    `\`/loc <latitude> <longitude>\`\n\n` +
    `Example: /loc 12.97 77.59`;

  bot.sendMessage(msg.chat.id, welcomeMsg, { parse_mode: "Markdown" });
});

bot.onText(/\/loc\s+([-\d.]+)\s+([-\d.]+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const latitude = parseFloat(match[1]);
  const longitude = parseFloat(match[2]);

  bot.sendMessage(chatId, "⏳ Fetching weather data, please wait...");

  try {
    // Fetch weather info
    const weatherData = await getWeather(latitude, longitude);
    const formattedResponse = formatWeatherResponse(weatherData);

    // Save user query to Firestore
    await db.collection("weatherReport").add({
      userId: userId,
      location: { latitude, longitude },
      response: {
        temperature: `${weatherData.current_weather.temperature}°C`,
        weathercode: weatherData.current_weather.weathercode,
        windspeed: `${weatherData.current_weather.windspeed} km/h`,
      },
      timestamp: new Date(),
    });

    // Send formatted response
    bot.sendMessage(chatId, formattedResponse, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("❌ Error:", error.message);
    bot.sendMessage(
      chatId,
      "⚠️ Sorry, I couldn’t fetch the weather data right now. Please try again later."
    );
  }
});
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("🤖 Telegram Weather Bot is running successfully!");
  })
  .listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
  });
