const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const utils = require("./utils.js");

class User {
    /**
     * @param {BetterSqlite3.Database} db 
     * @param {Discord.GuildMember | Discord.User} discordMember 
     */
    constructor(db, discordMember) {
        this.user = new InternalUser(db);

        if (Discord.GuildMember.prototype.isPrototypeOf(discordMember)) {
            this.user.loadByUserID(discordMember.user.id);
            this.user.Username = discordMember.user.username;
            
            this.deaf = discordMember.voice && discordMember.voice.deaf;
            this.streaming = discordMember.voice && discordMember.voice.streaming;
            
            // Insert just in case the user doesn't exist yet
            this.user.InsertOrUpdate();
        } else if (Discord.User.prototype.isPrototypeOf(discordMember)) {
            this.user.loadByUserID(discordMember.id);
            this.user.Username = discordMember.username;
            
            // Insert just in case the user doesn't exist yet
            this.user.InsertOrUpdate();
        }
    }

    getUsername() {
        return this.user.Username;
    }

    getUserID() {
        return this.user.UserID;
    }

    joinVoice() {
        this.user.JoinedTime = Date.now();

        this.user.InsertOrUpdate();
    }

    leaveVoice() {
        if (!this.user.IsLoaded) {
            console.log(this.user.Username + " not loaded! Not adding voice time");
        } else if (this.user.JoinedTime == 0) {
            // No time to add
            return;
        } else {
            let elapsedTime = Date.now() - this.user.JoinedTime
            this.user.VoiceTimeMS += elapsedTime;
            console.log("Adding " + elapsedTime + " ms to " + this.user.Username + " VoiceTimeMS for total of " + this.user.VoiceTimeMS + " ms");
        }

        this.user.JoinedTime = 0;

        this.user.InsertOrUpdate();
    }

    joinVoiceAlone() {
        console.log("Tracking " + this.user.Username + " alone time");
        this.user.AloneJoinedTime = Date.now();

        this.user.InsertOrUpdate();
    }

    leaveVoiceAlone() {
        if (!this.user.IsLoaded) {
            console.log(this.user.Username + " not loaded! Not adding voice time");
        } else if (this.user.AloneJoinedTime == 0) {
            // No time to add
            return;
        } else {
            let elapsedTime = Date.now() - this.user.AloneJoinedTime
            this.user.AloneTimeMS += elapsedTime;
            console.log("Adding " + elapsedTime + " ms to " + this.user.Username + " AloneTimeMS for total of " + this.user.AloneTimeMS + " ms");
        }

        this.user.AloneJoinedTime = 0;

        this.user.InsertOrUpdate();
    }

    startDeaf() {
        console.log("Tracking " + this.user.Username + " deaf time");
        this.user.DeafStartTime = Date.now();

        this.user.InsertOrUpdate();
    }

    stopDeaf() {
        if (!this.user.IsLoaded) {
            console.log(this.user.Username + " not loaded! Not adding deaf time");
        } else if (this.user.DeafStartTime == 0) {
            // No time to add
            return;
        } else {
            let elapsedTime = Date.now() - this.user.DeafStartTime
            this.user.DeafTimeMS += elapsedTime;
            console.log("Adding " + elapsedTime + " ms to " + this.user.Username + " DeafTimeMS for total of " + this.user.DeafTimeMS + " ms");
        }

        this.user.DeafStartTime = 0;

        this.user.InsertOrUpdate();
    }

    refreshStats() {
        if (!this.user.IsLoaded) {
            console.log(this.user.Username + " not loaded! Not refreshing stats")
            return;
        }

        let updated = false;

        if (this.user.JoinedTime != 0) {
            let elapsedTime = Date.now() - this.user.JoinedTime;
            this.user.VoiceTimeMS += elapsedTime;
            this.user.JoinedTime = Date.now();

            updated = true;
        }

        if (this.user.AloneJoinedTime != 0) {
            let elapsedTime = Date.now() - this.user.AloneJoinedTime;
            this.user.AloneTimeMS += elapsedTime;
            this.user.AloneJoinedTime = Date.now();
            
            updated = true;
        }

        if (this.user.DeafStartTime != 0) {
            let elapsedTime = Date.now() - this.user.DeafStartTime;
            this.user.DeafStartTime += elapsedTime;
            this.user.DeafStartTime = Date.now();
            
            updated = true;
        }

        if (updated) {
            this.user.InsertOrUpdate();
        }
    }

    resetJoinedTimes() {
        if (!this.user.IsLoaded) {
            return;
        }

        this.user.JoinedTime = 0;
        this.user.AloneJoinedTime = 0;
        this.user.DeafStartTime = 0;

        this.user.InsertOrUpdate();
    }
    
    getVoiceTimeStr() {
        return utils.getFormattedTime(this.user.VoiceTimeMS);
    }

    getAloneTimeStr() {
        return utils.getFormattedTime(this.user.AloneTimeMS);
    }

    getDeafTimeStr() {
        return utils.getFormattedTime(this.user.DeafTimeMS);
    }

    toString() {
        return `**${this.user.Username}**\nTotal Time: ${this.getVoiceTimeStr()}\nAlone Time: ${this.getAloneTimeStr()}\nDeaf Time: ${this.getDeafTimeStr()}`
    }
}

class UserList {
    constructor(db) {
        this.db = db;

        /** @type {User[]} */
        this.list = [];
    }

    loadByNonZeroJoinedTimes() {
        this.loadByCriteria("WHERE JoinedTime != 0 OR AloneTimeMS != 0");
    }

    loadByTop5VoiceTimeMS() {
        this.loadByCriteria("ORDER BY VoiceTimeMS DESC LIMIT 5");
    }

    loadByTop5AloneTimeMS() {
        this.loadByCriteria("ORDER BY AloneTimeMS DESC LIMIT 5");
    }

    loadByTop5DeafTimeMS() {
        this.loadByCriteria("ORDER BY DeafTimeMS DESC LIMIT 5");
    }

    loadByCriteria(criteria) {
        this.list = [];
        const rows = this.db.prepare(`
            SELECT
                UserID,
                Username,
                VoiceTimeMS,
                JoinedTime,
                AloneTimeMS,
                AloneJoinedTime,
                DeafTimeMS,
                DeafStartTime
            FROM
                User
            ${criteria}
        `).all();
        if (!rows) {
            return;
        }

        rows.forEach(row => {
            let user = new User(this.db);

            let internalUser = new InternalUser(this.db);
            internalUser.UserID = row.UserID;
            internalUser.Username = row.Username;
            internalUser.VoiceTimeMS = row.VoiceTimeMS;
            internalUser.JoinedTime = row.JoinedTime;
            internalUser.AloneTimeMS = row.AloneTimeMS;
            internalUser.AloneJoinedTime = row.AloneJoinedTime;
            internalUser.DeafTimeMS = row.DeafTimeMS;
            internalUser.DeafStartTime = row.DeafStartTime;

            internalUser.IsLoaded = true;

            user.user = internalUser;

            this.list.push(user);
        });
    }
}

class InternalUser {
    constructor(db) {
        this.db = db;

        this.UserID = "";
        this.Username = "";
        this.VoiceTimeMS = 0;
        this.JoinedTime = 0;
        this.AloneTimeMS = 0;
        this.AloneJoinedTime = 0;
        this.DeafTimeMS = 0;
        this.DeafStartTime = 0;

        this.IsLoaded = false;
    }
    
    loadByUserID(userID) {
        this.UserID = userID;
        const row = this.db.prepare(`
            SELECT
                UserID,
                Username,
                VoiceTimeMS,
                JoinedTime,
                AloneTimeMS,
                AloneJoinedTime,
                DeafTimeMS,
                DeafStartTime
            FROM
                User
            WHERE
                UserID = ?
        `).get(userID);
        if (!row) {
            return;
        }

        this.UserID = row.UserID;
        this.Username = row.Username;
        this.VoiceTimeMS = row.VoiceTimeMS;
        this.JoinedTime = row.JoinedTime;
        this.AloneTimeMS = row.AloneTimeMS;
        this.AloneJoinedTime = row.AloneJoinedTime;
        this.DeafTimeMS = row.DeafTimeMS;
        this.DeafStartTime = row.DeafStartTime;

        this.IsLoaded = true;
    }

    InsertOrUpdate() {
        if (this.IsLoaded) {
            // Update
            this.db.prepare(`
                UPDATE User SET
                    UserID = ?, 
                    Username = ?, 
                    VoiceTimeMS = ?, 
                    JoinedTime = ?,
                    AloneTimeMS = ?,
                    AloneJoinedTime = ?,
                    DeafTimeMS = ?,
                    DeafStartTime = ?
                WHERE UserID = ?
            `).run(
                this.UserID,
                this.Username,
                this.VoiceTimeMS,
                this.JoinedTime,
                this.AloneTimeMS,
                this.AloneJoinedTime,
                this.DeafTimeMS,
                this.DeafStartTime,
                this.UserID
            );
        } else {
            // Insert
            this.db.prepare(`
                INSERT INTO User (
                    UserID,
                    Username,
                    VoiceTimeMS,
                    JoinedTime,
                    AloneTimeMS,
                    AloneJoinedTime,
                    DeafTimeMS,
                    DeafStartTime
                )
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.UserID,
                this.Username,
                this.VoiceTimeMS,
                this.JoinedTime,
                this.AloneTimeMS,
                this.AloneJoinedTime,
                this.DeafTimeMS,
                this.DeafStartTime
            );
        }
    }
}

function refreshCCStats() {
    let users = new UserList(db);
    users.loadByNonZeroJoinedTimes();

    users.list.forEach(user => {
        user.refreshStats();
    });
}

module.exports = {User, UserList, refreshCCStats};