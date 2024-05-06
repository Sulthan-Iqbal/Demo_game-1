// Use require instead of import because of the error "Cannot use import statement outside a module"
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { concat, ethers, JsonRpcProvider } from "ethers";
import admin from "firebase-admin";
import serviceAccount from "../assets/serviceAccont.json" assert { type: "json" };
import { createConnection } from 'mysql';
import Web3 from "web3";
import EthereumTx from 'ethereumjs-tx';
import * as abis from "./poolabi.json" assert { type: "json" };

// config for your database
var config = {
  user: 'root',
  password: null,
  server: 'localhost',
  database: 'R_P_S'
};


let userState = {};

let contract;
let web3;
let contractAddress = "0x31E3045ffC184CA8903EadcEbc285DC4A0C72329";

const sqlConnection = createConnection(config);
sqlConnection.connect(function (err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }

  console.log('connected Successfully');
});

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
  initializeWeb3();
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
    // await ctx.replyWithSticker(
    //   "CAACAgIAAxkBAAERkCdl1NI_cw4KpD6i1Id7cuTGgh2JygACBQEAAladvQq35P22DkVfdzQE"
    // );
    if (existingWallet) {
      await ctx.sendMessage(
      `<b>🎮 Welcome to VIVID Bot! 🪨📄✂️</b>\n\n<i>Let's play a classic game of Rock-Paper-Scissors!</i>\n\n<b>🎮 **Game Rules:** 🎮</b>\n✅ Rock crushes Scissors🪨\n✅ Scissors cuts Paper✂️\n✅ Paper covers Rock📄\n\n<b>✨Are you ready? Let's see who's the champion!✨💪</b>\n`,
      { parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Create ➕",
                callback_data: `/create`
              },
              {
                text: "View 👁",
                callback_data: `/view`
              },
              {
                text: "Join 🤝",
                callback_data: `/join`
              }
            ]
          ],
        },
      });
    } else {
      // User doesn't have a wallet, create a new one
      const wallet = await createNewWallet(userId);

      // Send formatted message with new wallet details
      sendNewWalletDetails(ctx, wallet);
    }
  });

  // Function to get wallet details from Firestore


  // Function to send existing wallet details to the user
  async function sendExistingWalletDetails(ctx, walletDetails) {
    await ctx.replyWithMarkdownV2(
      `Great to see you again 😊\n\nYou already have a wallet\\. Here are your wallet details:\n\n🌐 Wallet Address: ||${walletDetails.address}||\n🔒 Private🔇 Key: ||${walletDetails.privateKey}||\n\nPlease store the private key securely or import it into a wallet like MetaMask\\.`);
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
      `Welcome to Game \n\n Here are your wallet details:\n\n🌐 Wallet Address: ||${wallet.address}||\n🔒 Private🔇 Key: ||${wallet.privateKey}||\n\nPlease store the private key securely or import it into a wallet like MetaMask\\. Run the /view command to use see the Rooms Available or Run /create to create a new room`
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
  try {
    // Listen to messages and reply with something when ever you receive them
    bot.hears("hi", async (ctx) => {
      await ctx.reply("Hey there!");
    });


    bot.on("callback_query", async (callbackQuery) => {
      try {
        let chatId = callbackQuery.from.id;
        if (callbackQuery.update.callback_query.data == '/create') {
          userState[chatId] = { action: 'create_room' };          
          callbackQuery.reply("Please Enter the pool amount 💵");
        } else if (callbackQuery.update.callback_query.data == '/view') {
          await callbackQuery.reply("Select Room Category",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Public 📢",
                    callback_data: "/public",
                  },
                  {
                    text: "Private 🔇",
                    callback_data: "/private"
                  }
                ]
              ],
            },
          });
        } else if (callbackQuery.update.callback_query.data == '/join') {         
          callbackQuery.reply("");
          await callbackQuery.reply("Select Room Category",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Public 📢",
                    callback_data: "/joinPublic",
                  },
                  {
                    text: "Private 🔇",
                    callback_data: "/joinPrivate"
                  }
                ]
              ],
            },
          });
        } else if (callbackQuery.update.callback_query.data == '/joinPublic') {
          userState[chatId] = { action: 'join_room_public' }; 
          callbackQuery.reply("Please Enter Room Name");
        } else if (callbackQuery.update.callback_query.data == '/joinPrivate') {
          userState[chatId] = { action: 'join_room_Private' }; 
          callbackQuery.reply("Please Enter Room Name & Password\n example: roomname password");
        } else if (callbackQuery.update.callback_query.data == '/public') {
          await getRooms(false, callbackQuery);
        } else if (callbackQuery.update.callback_query.data == '/private') {
          await getRooms(true, callbackQuery);
        } else if (callbackQuery.update.callback_query.data.toLowerCase().includes('/createprivate')) {
          const roomName = await generateRoomCode();
          const password = await generatePasscode();
          callbackQuery.reply("Please wait......");
          await createRoom(roomName, callbackQuery.from.id, true, password);
          const userId = callbackQuery.from.id;
          const existingWallet = await getWalletDetails(userId);
          console.log(existingWallet);
          const nonce = await web3.eth.getTransactionCount(existingWallet.address);
          const value = web3.utils.toWei(`${callbackQuery.update.callback_query.data.split('-')[1].replace(' ', '')}`, 'ether');

          const txObject = {
            from: existingWallet.address,
            to: contractAddress,
            value: value,
            gas: web3.utils.toHex(300000),
            gasPrice: web3.utils.toWei("5", "gwei"),
            nonce: web3.utils.toHex(nonce),
            data: contract.methods.createRoom(roomName).encodeABI(),
          };


          const signedTx = await web3.eth.accounts.signTransaction(txObject, existingWallet.privateKey);
          const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

          callbackQuery.reply(`Transaction sent: ${sentTx.transactionHash}`);

          await sqlConnection.query(`SELECT * FROM room_details where room_name = "${roomName}"`, async function (err, recordset) {
            if (err) console.log(err);
            else {
              if (recordset.length) {
                createSummary(recordset[0].room_id, callbackQuery.from.id, callbackQuery.update.callback_query.data.split('-')[1]);
              } else {
                callbackQuery.reply('No rooms Available');
              }
            }
          });
          callbackQuery.reply(`Your room Name: ${roomName}\nYour Password: ${password}\nPlease Share the room Details and wait till second user join\nTo view room name use /view command`);
        } else if (callbackQuery.update.callback_query.data.toLowerCase().includes('/createpublic')) {
          const roomName = await generateRoomCode();
          await createRoom(roomName, callbackQuery.from.id);
          callbackQuery.reply("Please wait......");
          const userId = callbackQuery.from.id;
          const existingWallet = await getWalletDetails(userId);
          const nonce = await web3.eth.getTransactionCount(existingWallet.address);
          const value = web3.utils.toWei(`${callbackQuery.update.callback_query.data.split('-')[1].replace(' ', '')}`, 'ether');
          console.log(value);

          const txObject = {
            from: existingWallet.address,
            to: contractAddress,
            value: value,
            gas: web3.utils.toHex(300000),
            gasPrice: web3.utils.toWei("5", "gwei"),
            nonce: web3.utils.toHex(nonce),
            data: contract.methods.createRoom(roomName).encodeABI(),
          };


          const signedTx = await web3.eth.accounts.signTransaction(txObject, existingWallet.privateKey);
          const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

          callbackQuery.reply(`Transaction sent: ${sentTx.transactionHash}`);
          await sqlConnection.query(`SELECT * FROM room_details where room_name = "${roomName}"`, async function (err, recordset) {
            if (err) console.log(err);
            else {
              if (recordset.length) {
                createSummary(recordset[0].room_id, callbackQuery.from.id, callbackQuery.update.callback_query.data.split('-')[1]);
              } else {
                callbackQuery.reply('No rooms Available');
              }
            }
          });
          callbackQuery.reply(`Your room Name: ${roomName}\nPlease Share the room Details and wait till second user join\nTo view room name use /view command`);
        } else if (callbackQuery.update.callback_query.data.toLowerCase().includes('rock') || callbackQuery.update.callback_query.data.toLowerCase().includes('paper') || callbackQuery.update.callback_query.data.toLowerCase().includes('scissor')) {
          handleGame(callbackQuery, callbackQuery.update.callback_query.data.split(' ')[1], callbackQuery.update.callback_query.data.split(' ')[0]);
        }
      } catch (err) {
        console.log(err);
      }
    });
    // Listen to messages with the type 'sticker' and reply whenever you receive them
    bot.on(message("text"), async (ctx) => {
      let chatId = ctx.from.id;
      try {
        if (isNumber(ctx.update.message.text) && userState[chatId].action === 'create_room') {
          delete userState[chatId];
          await ctx.reply("Select Room Category to create",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Public 📢",
                      callback_data: `/createPublic-${parseFloat(ctx.update.message.text)}`
                    },
                    {
                      text: "Private 🔇",
                      callback_data: `/createPrivate-${parseFloat(ctx.update.message.text)}`
                    }
                  ]
                ],
              },
            });
        } else if(userState[chatId].action === 'join_room_public') {
          delete userState[chatId];
          await sqlConnection.query(`SELECT * FROM room_details where room_name = "${ctx.update.message.text.replace(' ', '')}"`, async function (err, recordset) {
            if (err) console.log(err);
            else {
              if (recordset.length) {
                if (recordset[0].created_user === ctx.from.id) {
                  ctx.reply("You have Already Joined");
                } else {
                  await sqlConnection.query(`SELECT * FROM room_summary where room_id = ${recordset[0].room_id}`, async function (err, rooms) {
                    if (err) console.log(err);
                    else {
                      if (rooms.length) {
                        let roomName = ctx.update.message.text.replace(' ', '');
                        if (rooms[0].user_count < 2) {
                          ctx.reply("please Wait...");
                          const userId = ctx.from.id;
                          const existingWallet = await getWalletDetails(userId);
                          const nonce = await web3.eth.getTransactionCount(existingWallet.address);
                          const value = web3.utils.toWei(`${rooms[0].player1_amount}`, 'ether');
                          console.log(value);

                          const txObject = {
                            from: existingWallet.address,
                            to: contractAddress,
                            value: value,
                            gas: web3.utils.toHex(300000),
                            gasPrice: web3.utils.toWei("5", "gwei"),
                            nonce: web3.utils.toHex(nonce),
                            data: contract.methods.joinRoom(roomName).encodeABI(),
                          };


                          const signedTx = await web3.eth.accounts.signTransaction(txObject, existingWallet.privateKey);
                          const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

                          ctx.reply(`Transaction sent: ${sentTx.transactionHash}`);
                          var query = `update room_summary set player2_id= ${ctx.message.chat.id}, user_count= 2, player2_amount= ${rooms[0].player1_amount} where room_id = ${rooms[0].room_id}`;
                          await sqlConnection.query(query, async function (error, data) {
                            if (error)
                              throw error;
                            else {
                              ctx.reply("Your opponent have joined the game\nYou have 10 Minutes to select option");
                              await returnGameOptions(ctx, rooms[0].room_id, ctx.from.id);
                            }
                          });
                          var getQuery = `select * from room_summary where room_id = ${rooms[0].room_id}`;
                          await sqlConnection.query(getQuery, async function (error, data) {
                            if (error)
                              throw error;
                            else {
                              console.log(data[0].player1_id, data[0]);
                              await ctx.telegram.sendMessage(data[0].player1_id, `Your opponent have joined the game\nYou have 10 Minutes to select option`);
                              await handleExpiry(ctx, rooms[0].room_id);
                              await returnGameOptions(ctx, rooms[0].room_id, data[0].player1_id);
                            }
                          });
                        } else {
                          ctx.reply('Already two Players are playing');
                        }
                      } else {
                        ctx.reply('Please Wait till second user join');
                        createSummary(rooms[0].room_id, ctx.message.chat.id);
                      }
                    }
                  });
                }
              } else {
                ctx.reply('No rooms Available');
              }
            }
          });
          
        } else if(userState[chatId].action === 'join_room_Private') {
          delete userState[chatId];
          await sqlConnection.query(`SELECT * FROM room_details where room_name = "${ctx.update.message.text.split(' ')[0].replace(' ', '')}"`, async function (err, recordset) {
            if (err) console.log(err);
            else {
              if (recordset.length) {
                if (recordset[0].created_user === ctx.from.id) {
                  ctx.reply("You have Already Joined");
                } else if (recordset[0].password !== ctx.update.message.text.split(' ')[1].replace(' ', '')) {
                  ctx.reply("Password Incorrect");
                } else {
                  await sqlConnection.query(`SELECT * FROM room_summary where room_id = ${recordset[0].room_id}`, async function (err, rooms) {
                    if (err) console.log("sqlerror: ", err);
                    else {
                      if (rooms.length) {
                        let roomName = ctx.update.message.text.split(' ')[0].replace(' ', '');
                        if (rooms[0].user_count < 2) {
                          ctx.reply("please Wait...");
                          const userId = ctx.from.id;
                          const existingWallet = await getWalletDetails(userId);
                          const nonce = await web3.eth.getTransactionCount(existingWallet.address);
                          const value = web3.utils.toWei(`${rooms[0].player1_amount}`, 'ether');
                          console.log(value);

                          const txObject = {
                            from: existingWallet.address,
                            to: contractAddress,
                            value: value,
                            gas: web3.utils.toHex(300000),
                            gasPrice: web3.utils.toWei("5", "gwei"),
                            nonce: web3.utils.toHex(nonce),
                            data: contract.methods.joinRoom(roomName).encodeABI(),
                          };


                          const signedTx = await web3.eth.accounts.signTransaction(txObject, existingWallet.privateKey);
                          const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

                          ctx.reply(`Transaction sent: ${sentTx.transactionHash}`);
                          var query = `update room_summary set player2_id= ${ctx.message.chat.id}, user_count= 2, player2_amount= ${recordset[0].player1_amount} where room_id = ${recordset[0].room_id}`;
                          await sqlConnection.query(query, async function (error, data) {
                            if (error)
                              console.log("Error", err);
                            else {
                              await ctx.reply("Your opponent have joined the game\nYou have 10 Minutes to select option");
                              await returnGameOptions(ctx, recordset[0].room_id, ctx.from.id);
                            }
                          });
                          var getQuery = `select * from room_summary where room_id = ${recordset[0].room_id}`;
                          await sqlConnection.query(getQuery, async function (error, data) {
                            if (error)
                              console.log("Error", err);
                            else {
                              await ctx.telegram.sendMessage(data[0].player1_id, `Your opponent have joined the game\nYou have 10 Minutes to select option`);
                              await handleExpiry(ctx, recordset[0].room_id);
                              await returnGameOptions(ctx, recordset[0].room_id, data[0].player1_id);
                            }
                          });
                        } else {
                          ctx.reply('Already two Players are playing');
                        }
                      } else {
                        ctx.reply('Please Wait till second user join');
                        createSummary(recordset[0].room_id, ctx.message.chat.id);
                      }
                    }
                  });
                }
              } else {
                ctx.reply('No rooms Available');
              }
            }
          });
        } else {
          await ctx.reply(
            "I don't understand text but I like stickers, send me some!"
          );
          await ctx.reply("Or you can send me one of these commands \n/start\n/help");
        }
      } catch (err) {
        console.log(err);
      }
    });

    // Listen to messages with the type 'sticker' and reply whenever you receive them
    bot.on(message("sticker"), async (ctx) => {
      await ctx.reply("I like your sticker! 🔥");
    });
  } catch (err) {
    console.log(err)
  }
}

/**
 * Listen to messages send by MiniApp through sendData(data)
 * @see https://core.telegram.org/bots/webapps#initializing-mini-apps
 *
 * @param bot Telegraf bot instance
 */
function listenToMiniAppData(bot) {
  try {
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
  } catch (err) {
    console.log(err);
  }
}

/**
 * Assigns query listeners such inlines and callbacks
 *
 * @param bot Telegraf bot instance
 *
 */
function listenToQueries(bot) {
  try {
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
  } catch (err) {
    console.log(err);
  }
}

/**
 * Listens to process stop events and performs a graceful bot stop
 *
 * @param bot Telegraf bot instance
 *
 */
function enableGracefulStop(bot) {
  try {
    // Enable graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    console.log(err);
  }
}

async function generateRoomCode() {
  try {
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    let roomCode = '';
    for (let i = 0; i < 8; i++) {
      roomCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return roomCode;
  } catch (err) {
    console.log(err);
  }
}

async function generatePasscode() {
  try {
    const characters = '0123456789';
    let roomCode = '';
    for (let i = 0; i < 8; i++) {
      roomCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return roomCode;
  } catch (err) {
    console.log(err);
  }
}

async function createRoom(roomName, createdUser, isPrivate = false, password = '') {
  try {
    var query = isPrivate ? `INSERT INTO room_details 
	(room_name, created_user, room_type, password ) 
	VALUES ("${roomName}", "${createdUser}", 0, "${password}")` :
      `INSERT INTO room_details 
	(room_name, created_user, room_type ) 
	VALUES ("${roomName}", "${createdUser}", 1)
	`;
    sqlConnection.query(query, function (error, data) {
      if (error)
        throw error;
      else
        console.log("Created Successfully", data);
    });
  } catch (err) {
    console.log(err);
  }
}

async function getRooms(isPrivate, callbackQuery) {
  try {
    var query = isPrivate ? `SELECT * FROM room_details where room_type = 0 && status = 1` : `SELECT * FROM room_details where room_type = 1 && status = 1`;
    sqlConnection.query(query, function (error, data) {
      if (error)
        throw error;
      else {
        let reply = [];
        data.forEach(element => {
          reply.push(`\n${element.room_name}`);
        });
        callbackQuery.reply(`List of Rooms ${reply.toString().replaceAll(',', '')}`);
        callbackQuery.reply(isPrivate ? `To Join room please enter room in below format\nJoin roomName: <roomName> \nPassword: <password>` : `To Join room please enter room in below format\nJoin roomName: <roomName>`);
      }
    });
  } catch (err) {
    console.log(err);
  }
}


async function createSummary(roomId, userId, amount = 0) {
  try {
    var query = `
    INSERT INTO room_summary 
    (room_id, player1_id, user_count,player1_amount) 
    VALUES ("${roomId}", "${userId}", 1, ${amount})
    `;
    sqlConnection.query(query, function (error, data) {
      if (error)
        throw error;
      else
        console.log("Created Successfully");
    });
  } catch (err) {
    console.log(err);
  }
}

async function handleGame(callbackQuery, roomId, selection) {
  try {
    var query = `select * from room_summary where room_id = ${roomId}`;
    sqlConnection.query(query, async function (error, data) {
      if (error)
        throw error;
      else {
        if (data[0].player1_selection || data[0].player2_selection) {
          if (data[0].player1_selection) {
            handleWin(data[0].player1_selection, selection, callbackQuery, roomId, data[0]);
          } else {
            handleWin(selection, data[0].player2_selection, callbackQuery, roomId, data[0]);
          }
        }
        else if (data[0].player1_id == callbackQuery.from.id) {
          const query = `update room_summary set player1_selection= "${selection}" where room_id = ${roomId}`;
          await sqlConnection.query(query, async function (error, data) {
            if (error)
              throw error;
            else
              callbackQuery.reply("Please wait till another selects an option");
          });

        } else if (data[0].player2_id == callbackQuery.from.id) {
          const query = `update room_summary set player2_selection= "${selection}" where room_id = ${roomId}`;
          await sqlConnection.query(query, async function (error, data) {
            if (error)
              throw error;
            else
              callbackQuery.reply("Please wait till another selects an option");
          });
        }
      }
    });
  } catch (err) {
    console.log(err);
  }

}

async function handleWin(player1_selection, player2_selection, callbackQuery, roomId, room_summary) {
  try {
    let winner = '';
    if (player1_selection == player2_selection) {
      winner = null;
    } else {
      if (player1_selection == 'rock') {
        if (player2_selection == 'scissor') {
          winner = 'player1';
        } else if (player2_selection == 'paper') {
          winner = 'player2';
        }
      } else if (player1_selection == 'scissor') {
        if (player2_selection == 'rock') {
          winner = 'player2';
        } else if (player2_selection == 'paper') {
          winner = 'player1';
        }
      } else if (player1_selection == 'paper') {
        if (player2_selection == 'scissor') {
          winner = 'player2';
        } else if (player2_selection == 'rock') {
          winner = 'player1';
        }
      }
    }
    var query1 = `select * from room_details where room_id = ${roomId}`;
    let roomName
    await sqlConnection.query(query1, async function (error, data) {
      if (error)
        throw error;
      else {
        console.log("roomname", data[0]);
        roomName = data[0].room_name;
        await declareWinner(winner, room_summary.player1_id, room_summary.player2_id, callbackQuery, player1_selection, player2_selection, roomId, roomName);
      }
    });

    const query = `update room_summary set player1_selection= "${player1_selection}", player2_selection= "${player2_selection}" where room_id = ${roomId}`;
    await sqlConnection.query(query, async function (error, data) {
      if (error)
        throw error;
      else
        console.log("updated");
    });
  } catch (err) {
    console.log(err);
  }
}

async function handleExpiry(ctx, roomId) {
  try {
    setTimeout(async () => {
      let winner = '';
      var query = `select * from room_details where room_id = ${roomId}`;
      sqlConnection.query(query, async function (error, data) {
        if (error)
          throw error;
        else {
          if (data[0].status) {
            const roomName = data[0].room_name;
            var query1 = `select * from room_summary where room_id = ${roomId}`;
            sqlConnection.query(query1, async function (error, data) {
              if (error)
                throw error;
              else {
                if (data[0].player1_selection || data[0].player2_selection) {
                  if (data[0].player1_selection) {
                    winner = 'player1';
                  } else {
                    winner = 'player2';
                  }
                }
              }
              await declareWinner(winner, data[0].player1_id, data[0].player2_id, ctx, data[0].player1_selection, data[0].player2_selection, roomId, roomName);
            });
          }
        }
      });
    }, 600000);
  } catch (err) {
    console.log(err);
  }
}

async function declareWinner(winner, player1_id, player2_id, ctx, player1_selection = '', player2_selection = '', roomId, roomName) {
  try {
    let winnerquery = '';
    if (winner) {
      ctx.reply("please Wait...");
      const userId = winner === 'player1' ? player1_id : player2_id;
      const existingWallet = await getWalletDetails(userId);
      const nonce = await web3.eth.getTransactionCount(existingWallet.address);
      // const senderAddress = (await web3.eth.getAccounts())[0];


      const txObject = {
        to:contractAddress,
        gas: web3.utils.toHex(3000000),
        gasPrice: web3.utils.toWei("5", "gwei"),
        value:'0',
        data: contract.methods.declareWinner(roomName, existingWallet.address).encodeABI(),
        nonce:nonce
      };


      const signedTx = await web3.eth.accounts.signTransaction(txObject, existingWallet.privateKey);
      const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      ctx.reply(`Transaction sent: ${sentTx.transactionHash}`);
      if (winner == 'player1') {
        winnerquery = `update room_details set winner_user= ${player1_id}, status = 0 where room_id = ${roomId}`;
        ctx.telegram.sendMessage(player1_id, `You won the match\nYour selection: ${player1_selection}\nOpponent selection: ${player2_selection}`);
        ctx.telegram.sendMessage(player2_id, `You lost the match\nYour selection: ${player2_selection}\nOpponent selection: ${player1_selection}`);
      } else {
        winnerquery = `update room_details set winner_user= ${player2_id}, status = 0 where room_id = ${roomId}`;
        ctx.telegram.sendMessage(player1_id, `You lost the match\nYour selection: ${player1_selection}\nOpponent selection: ${player2_selection}`);
        ctx.telegram.sendMessage(player2_id, `You won the match\nYour selection: ${player2_selection}\nOpponent selection: ${player1_selection}`);
      }
    } else {
      ctx.reply("please Wait...");
      const existingWallet = await getWalletDetails(player1_id);
      const nonce = await web3.eth.getTransactionCount(existingWallet.address);
      // const senderAddress = (await web3.eth.getAccounts())[0];


      const txObject = {
        from:existingWallet.address,
        to:contractAddress,
        gas: web3.utils.toHex(3000000),
        gasPrice: web3.utils.toWei("5", "gwei"),
        value:'0',
        data: contract.methods.handleDraw(roomName).encodeABI(),
        nonce:nonce
      };


      const signedTx = await web3.eth.accounts.signTransaction(txObject, existingWallet.privateKey);
      const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      ctx.reply(`Transaction sent: ${sentTx.transactionHash}`);
      winnerquery = `update room_details set status = 0 where room_id = ${roomId}`;
      ctx.telegram.sendMessage(player1_id, `Match drawn both selected ${player1_selection}`);
      ctx.telegram.sendMessage(player2_id, `Match drawn both selected ${player1_selection}`);
    }
    await sqlConnection.query(winnerquery, async function (error, data) {
      if (error)
        throw error;
      else
        console.log("updated");
    });

  } catch (err) {
    console.log(err);
  }
}
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

async function returnGameOptions(botInstance, roomId, playerId) {
  try {
    await botInstance.telegram.sendMessage(playerId, "Select an option",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Rock",
                callback_data: `rock ${roomId}`
              },
              {
                text: "Paper",
                callback_data: `paper ${roomId}`
              },
              {
                text: "Scissor",
                callback_data: `scissor ${roomId}`
              }
            ]
          ],
        },
      });
  } catch (err) {
    console.log(err);
  }
}

function isNumber(value) {
  console.log(!isNaN(parseFloat(value)), isFinite(value))
  console.log(!isNaN(parseFloat(value)) && isFinite(value));
  return !isNaN(parseFloat(value)) && isFinite(value);
}


async function initializeWeb3() {
  // Check if MetaMask is installed

  try {
    // Create a new Web3 instance
    const blastEndpoint = "https://eth-sepolia.g.alchemy.com/v2/hbT0R7l5bcMZmoOBbNdXuS_5ZagTyFBy";

    // const blastEndpoint="https://ethereum-sepolia-rpc.publicnode.com";

    const newWeb3 = new Web3(
      new Web3.providers.HttpProvider(blastEndpoint)
    );
    web3 = newWeb3;

    // Initialize contract
    try {

      const contractInstance = new newWeb3.eth.Contract(
        abis.default,
        contractAddress
      );
      contract = contractInstance;
    } catch (error) {
      console.error("Error initializing contract:", error);
    }
  } catch (error) {
    console.error("Error connecting to MetaMask:", error);
  }
};
