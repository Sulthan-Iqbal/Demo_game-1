// Use require instead of import because of the error "Cannot use import statement outside a module"
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { concat, ethers } from "ethers";
import admin from "firebase-admin";
import serviceAccount from "../serviceAccont.json" assert { type: "json" };
import { createConnection } from 'mysql'

// config for your database
var config = {
  user: 'root',
  password: null,
  server: 'localhost',
  database: 'R_P_S'
};

const sqlConnection = createConnection(config);

// Create instance of socket.io server

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
/**
 * Creates and launches Telegram bot, and assigns all the required listeners
 *
 * @param token HTTP API token received from @BotFather(https://t.me/BotFather) after creating a bot
 *
 * @remarks
 * Make sure to save the token in a safe and secure place. Anyone with the access can control your bot.
 *
 */
export function launchBot(token) {
  // Create a bot using the token received from @BotFather(https://t.me/BotFather)
  const bot = new Telegraf(token);

  // Assign bot listeners
  listenToCommands(bot);
  listenToMessages(bot);
  listenToQueries(bot);
  listenToMiniAppData(bot);

  // Launch the bot
  bot.launch().then(() => console.log("bot launched"));

  // Handle stop events
  enableGracefulStop(bot);

  return bot;
}

/**
 * Assigns command listeners such as /start and /help
 *
 * @param bot Telegraf bot instance
 *
 */

function listenToCommands(bot) {
  bot.start(async (ctx) => {
    // Get the user ID from the Telegram context
    const userId = ctx.from.id;

    // Check if the user already has a wallet
    const existingWallet = await getWalletDetails(userId);
    await ctx.replyWithSticker(
      "CAACAgIAAxkBAAERkCdl1NI_cw4KpD6i1Id7cuTGgh2JygACBQEAAladvQq35P22DkVfdzQE"
    );
    if (existingWallet) {
      await ctx.sendMessage(
        `🚀 Dive into the app and start your money-making journey! 💰 Run the /view command to use see the Rooms Available or Run /create to create a new room`,
        // {
        //   reply_markup: {
        //     inline_keyboard: [
        //       [
        //         {
        //           text: "Bart",
        //           web_app: { url: process.env.APP_URL },
        //         },
        //       ],
        //     ],
        //   },
        // }
      );
    } else {
      // User doesn't have a wallet, create a new one
      const wallet = await createNewWallet(userId);

      // Send formatted message with new wallet details
      sendNewWalletDetails(ctx, wallet);
    }
    ctx.setChatMenuButton({
      text: "Bart",
      type: "web_app",
      web_app: { url: process.env.APP_URL },
    });
  });

  // Function to get wallet details from Firestore
  async function getWalletDetails(userId) {
    try {
      const walletsCollection = admin.firestore().collection("wallets");
      const userWallet = await walletsCollection.doc(userId.toString()).get();

      if (userWallet.exists) {
        return userWallet.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting wallet details:", error);
      return null;
    }
  }

  // Function to send existing wallet details to the user
  async function sendExistingWalletDetails(ctx, walletDetails) {
    await ctx.replyWithMarkdownV2(
      `Great to see you again 😊\n\nYou already have a wallet\\. Here are your wallet details:\n\n🌐 Wallet Address: ||${walletDetails.address}||\n🔒 Private Key: ||${walletDetails.privateKey}||\n\nPlease store the private key securely or import it into a wallet like MetaMask\\.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Bart",
                web_app: { url: process.env.APP_URL },
              },
            ],
          ],
        },
      }
    );
  }

  // Function to create a new wallet and save details in Firestore
  async function createNewWallet(userId) {
    try {
      // Generate a random wallet
      const wallet = ethers.Wallet.createRandom();

      // Save the wallet details in Firestore
      await saveWalletDetails(userId, wallet);

      return wallet;
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    }
  }

  // Function to send formatted message with new wallet details
  async function sendNewWalletDetails(ctx, wallet) {
    await ctx.replyWithMarkdownV2(
      `Welcome to BartFund \n\n Here are your wallet details:\n\n🌐 Wallet Address: ||${wallet.address}||\n🔒 Private Key: ||${wallet.privateKey}||\n\nPlease store the private key securely or import it into a wallet like MetaMask\\.`
    );

    await ctx.sendMessage(
      `🚀 Dive into the app and start your money-making journey! 💰`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Bart",
                web_app: { url: process.env.APP_URL },
              },
            ],
          ],
        },
      }
    );
  }

  // Register a listener for the /help command, and reply with a message whenever it's used
  bot.help(async (ctx) => {
    await ctx.reply("Run the /start command to use our mini app");
  });

  // Register a listener for the /createWallet command, and reply with a message whenever it's used

  bot.command("wallet", async (ctx) => {
    // Get the user ID from the Telegram context
    const userId = ctx.from.id;

    // Get the user's wallet details
    const existingWallet = await getWalletDetails(userId);

    if (existingWallet) {
      // Send existing wallet details
      await sendExistingWalletDetails(ctx, existingWallet);
    } else {
      // User doesn't have a wallet
      await ctx.reply(
        "You don't have a wallet yet. Use the /createWallet command to create a new one."
      );
    }
  });
}

// Function to save wallet details in Firestore
async function saveWalletDetails(userId, wallet) {
  try {
    const walletsCollection = admin.firestore().collection("wallets");
    await walletsCollection.doc(userId.toString()).set({
      address: wallet.address,
      privateKey: wallet.privateKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Wallet details saved for user ${userId}`);
  } catch (error) {
    console.error("Error saving wallet details:", error);
    throw error;
  }
}

/**
 * Assigns message listeners such as text and stickers
 *
 * @param bot Telegraf bot instance
 *
 */
function listenToMessages(bot) {
  // Listen to messages and reply with something when ever you receive them
  bot.hears("hi", async (ctx) => {
    await ctx.reply("Hey there!");
  });

  bot.hears("/view", async (ctx) => {
    await ctx.reply("Select Room Category",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Public",
                callback_data: "/public"
              },
              {
                text: "Private",
                callback_data: "/private"
              }
            ]
          ],
        },
      });
  });


  bot.hears("/create", async (ctx) => {
    await ctx.reply("Select Room Category to create",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Public",
                callback_data: "/createPublic"
              },
              {
                text: "Private",
                callback_data: "/createPrivate"
              }
            ]
          ],
        },
      });
  });


  bot.on("callback_query", async (callbackQuery) => {
    if (callbackQuery.update.callback_query.data == '/public') {
      await sqlConnection.query('SELECT * FROM room_details', function (err, recordset) {
        if (err) console.log(err);
        let reply = []
        recordset.forEach(element => {
          reply.push(`\n/${element.room_name}`);
        })
        callbackQuery.reply(`List of Rooms ${reply.toString().replaceAll(',', '')}`);
        callbackQuery.reply(`To Join room please enter room in below format\n join roomName: <roomName>`);
      });
    } else if (callbackQuery.update.callback_query.data == '/private') {
      await sqlConnection.query('SELECT * FROM room_details', function (err, recordset) {
        if (err) console.log(err);
        let reply = []
        recordset.forEach(element => {
          reply.push(`\n/${element.room_name}`);
        })
        callbackQuery.reply(`List of Rooms ${reply.toString().replaceAll(',', '')}`);
        callbackQuery.reply(`To Join room please enter room in below format\n join roomName: <roomName> \nPassword: <password>`);
      });
    } else if (callbackQuery.update.callback_query.data == '/createPrivate') {
      callbackQuery.reply(`Please enter Room Name and Password in below Format\nroomName: <value> \nPassword: <value>`);
    } else if (callbackQuery.update.callback_query.data == '/createPublic') {
      callbackQuery.reply(`Please enter Room Name in below Format\nroomName: <value> `);
    }
  });
  // Listen to messages with the type 'sticker' and reply whenever you receive them
  bot.on(message("text"), async (ctx) => {
    if (ctx.update.message.text.includes('roomName') && ctx.update.message.text.includes('password')) {
        var roomName = request.body.roomName;
        var createdUser = 'sulthan';
        var query = `
      INSERT INTO room_details 
      (room_name, created_user) 
      VALUES ("${roomName}", "${createdUser}")
      `;
        sqlConnection.query(query, function (error, data) {
          if (error)
            throw error;
          else
          ctx.reply(
            "Room Created" +data
          )
        });
    } else if (ctx.update.message.text.includes('roomName')) {
        var roomName = ctx.update.message.text.split(':')[1];
        var createdUser = 'sulthan';
        var query = `
      INSERT INTO room_details 
      (room_name, created_user) 
      VALUES ("${roomName}", "${createdUser}")
      `;
        sqlConnection.query(query, function (error, data) {
          if (error)
            throw error;
          else
          ctx.reply(
            "Room Created" + data
          );
        });
    } else {
      await ctx.reply(
        "I don't understand text but I like stickers, send me some!"
      );
      await ctx.reply("Or you can send me one of these commands \n/start\n/help");
    }
  });

  // Listen to messages with the type 'sticker' and reply whenever you receive them
  bot.on(message("sticker"), async (ctx) => {
    await ctx.reply("I like your sticker! 🔥");
  });
}

/**
 * Listen to messages send by MiniApp through sendData(data)
 * @see https://core.telegram.org/bots/webapps#initializing-mini-apps
 *
 * @param bot Telegraf bot instance
 */
function listenToMiniAppData(bot) {
  bot.on("message", async (ctx) => {
    if (ctx.message?.web_app_data?.data) {
      try {
        const data = ctx.message?.web_app_data?.data;
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Got message from MiniApp"
        );
        await ctx.telegram.sendMessage(ctx.message.chat.id, data);
      } catch (e) {
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Got message from MiniApp but failed to read"
        );
        await ctx.telegram.sendMessage(ctx.message.chat.id, e);
      }
    }
  });
}

/**
 * Assigns query listeners such inlines and callbacks
 *
 * @param bot Telegraf bot instance
 *
 */
function listenToQueries(bot) {
  bot.on("callback_query", async (ctx) => {
    // Explicit usage
    await ctx.telegram.answerCbQuery(ctx.callbackQuery.id);

    // Using context shortcut
    await ctx.answerCbQuery();
  });

  bot.on("inline_query", async (ctx) => {
    const article = {
      type: "article",
      id: ctx.inlineQuery.id,
      title: "Message for query",
      input_message_content: {
        message_text: `Message for query`,
      },
    };

    const result = [article];
    // Explicit usage
    await ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, result);

    // Using context shortcut
    await ctx.answerInlineQuery(result);
  });
}

/**
 * Listens to process stop events and performs a graceful bot stop
 *
 * @param bot Telegraf bot instance
 *
 */
function enableGracefulStop(bot) {
  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
