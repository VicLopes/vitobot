const Discord = require("discord.js")
const { prefix, token } = require("./config.json")
const ytdl = require("ytdl-core")
const search = require("yt-search")

const client = new Discord.Client()

const queue = new Map()

client.once("ready", () => {
  console.log("Ready!")
});

client.once("reconnecting", () => {
  console.log("Reconnecting!")
});

client.once("disconnect", () => {
  console.log("Disconnect!")
});

client.on("message", async message => {
  if (message.author.bot) return
  if (!message.content.startsWith(prefix)) return

  const serverQueue = queue.get(message.guild.id)

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return
  } else {
    message.reply(`Comando inválido! (é ${prefix}play, ${prefix}stop, ${prefix}skip)`);
  }
})

async function execute(message, serverQueue) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "Esteja num canal de voz pra tocar música!"
    )
  const permissions = voiceChannel.permissionsFor(message.client.user)
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) 
    return message.channel.send(
      "não tenho permissões :("
    )

  const args = message.content

   const songInfo = await ytdl
     .getInfo(args.split(" ")[1])
     .then((result) => {
       return result;
     })
     .catch(async (error) => {
       return await search(args)
         .then(async (result) => {
           return await ytdl.getInfo(result.videos[0].url);
         })
         .catch((error) => {
           message.channel.send(error);
         });
     });

  const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
   }

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id, queueContruct)

    queueContruct.songs.push(song)

    try {
      var connection = await voiceChannel.join()
      queueContruct.connection = connection
      play(message.guild, queueContruct.songs[0])
    } catch (err) {
      console.log(err)
      queue.delete(message.guild.id)
      return message.channel.send(err)
    }
  } else {
    serverQueue.songs.push(song)
    return message.reply(`${song.title} adicionado à fila.`)
  }
}

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Não está presente em um canal de voz"
    );
  if (!serverQueue)
    return message.reply("Não existe fila iniciando")
  serverQueue.connection.dispatcher.end()
  return message.reply("Pulando a música")
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Você não está em um canal de voz para parar a música"
    )
    
  if (!serverQueue)
    return message.channel.send("Não existem músicas tocando atualmente")
    
  serverQueue.songs = []
  serverQueue.connection.dispatcher.end()
  return message.reply("Sem mais, acabou")
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id)
  if (!song) {
    serverQueue.voiceChannel.leave()
    serverQueue.textChannel.send("Fim da playlist, saindo para salvar recursos")
    queue.delete(guild.id)
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error))
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)
  serverQueue.textChannel.send(`Começou a tocar: **${song.title}**`)
}

 async function findVideo(searchTerm) {
  await ytdl
    .getInfo(searchTerm)
    .then((result) => {
      return result;
    })
    .catch((error) => {
      console.log(error);
    });
}

client.login(token);