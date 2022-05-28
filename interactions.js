const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const {User, UserList, refreshCCStats} = require("./user.js");

function ccme(interaction) {
    console.log("ccme");
    refreshCCStats();

    let user = new User(db, interaction.user);
    return user.toString()
}

function cctop() {
    console.log("cctop");
    refreshCCStats();

    let users = new UserList(db);
    users.loadByTop5VoiceTimeMS();

    let replyStr = "Top Total Voice Channel Time\n";
    users.list.forEach((user, i) => {
        replyStr += `${i + 1}. ${user.getUsername()}: ${user.getVoiceTimeStr()}\n`
    });
    
    users.loadByTop5AloneTimeMS();

    replyStr += "\nTop Voice Channel Losers\n";
    users.list.forEach((user, i) => {
        replyStr += `${i + 1}. ${user.getUsername()}: ${user.getAloneTimeStr()}\n`
    });
    
    users.loadByTop5DeafTimeMS();

    replyStr += "\nTop \"why are you even in here?\"\n";
    users.list.forEach((user, i) => {
        replyStr += `${i + 1}. ${user.getUsername()}: ${user.getDeafTimeStr()}\n`
    });

    users.loadByTop5StreamingTimeMS();

    replyStr += "\nTop Streamers\n";
    users.list.forEach((user, i) => {
        replyStr += `${i + 1}. ${user.getUsername()}: ${user.getStreamingTimeStr()}\n`
    });

    return replyStr;
}

module.exports = {
    ccme,
    cctop,
};