import { launchBot } from "../telegram/R_P_S_bot.js";
import { launchApi, MESSAGE_PATH } from "../http/Api.js";

/**
 * This is the entry point of our app
 * Call this method inside index.js to launch the bot and the api
 *
 */
export function launchApp() {
  // Read token from .env file and use it to launch telegram bot
  const bot = launchBot(process.env.BOT_TOKEN);

  // Launch api
  const api = launchApi();

  // Listen to post requests on messages endpoint
  api.post(MESSAGE_PATH, async (request, response) => {
    await handleMessageRequest(bot, request, response);
  });
}

/**
 * Receives data from the mini app and sends a simple message using answerWebAppQuery
 * @see https://core.telegram.org/bots/api#answerwebappquery
 *
 * We will use InlineQueryResult to create our message
 * @see https://core.telegram.org/bots/api#inlinequeryresult
 */
const handleMessageRequest = async (bot, request, response) => {
  try {
    // Read data from the request body received by the mini app
    const { userId, message } = request.body;

    // We are creating InlineQueryResultArticle
    // See https://core.telegram.org/bots/api#inlinequeryresultarticle
    console.log(request.body);
    await bot.telegram.sendSticker(
      userId,
      "CAACAgIAAxkBAAERoMBl2zq4d21_vPBE8AABON8q1L82YUgAAscAA5i_gA0KPH5UAAGjNVQ0BA"
    );
    await bot.telegram.sendMessage(userId, message, {
      parse_mode: "HTML",
    });

    // End the request with a success code
    await response.status(200).json({
      message: "success!",
    });
  } catch (e) {
    console.log(`handleMessageRequest error ${e}`);

    await response.status(500).json({
      error: e,
    });
  }
};
