const utils = require("./utils.js");

class User {
    constructor(db, discordUser) {
        this.user = new InternalUser(db);

        if (discordUser) {
            this.user.loadByUserID(discordUser.id);
            
            this.user.Username = discordUser.username;
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
            console.log(this.user.username + " not loaded! Not adding voice time");
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
            console.log(this.user.username + " not loaded! Not adding voice time");
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

    refreshStats() {
        if (!this.user.IsLoaded) {
            console.log(this.user.username + " not loaded! Not refreshing stats")
            return;
        }

        if (this.user.JoinedTime != 0) {
            let elapsedTime = Date.now() - this.user.JoinedTime;
            this.user.VoiceTimeMS += elapsedTime;
            this.user.JoinedTime = Date.now();
            
            this.user.InsertOrUpdate();
        }

        if (this.user.AloneJoinedTime != 0) {
            let elapsedTime = Date.now() - this.user.AloneJoinedTime;
            this.user.AloneTimeMS += elapsedTime;
            this.user.AloneJoinedTime = Date.now();
            
            this.user.InsertOrUpdate();
        }
    }

    resetJoinedTimes() {
        if (!this.user.IsLoaded) {
            return;
        }

        this.user.JoinedTime = 0;
        this.user.AloneJoinedTime = 0;

        this.user.InsertOrUpdate();
    }
    
    getVoiceTimeStr() {
        return utils.getFormatedTime(this.user.VoiceTimeMS);
    }

    getAloneTimeStr() {
        return utils.getFormatedTime(this.user.AloneTimeMS);
    }

    toString() {
        return `**${this.user.Username}**\nTotal Time: ${this.getVoiceTimeStr()}\nAlone Time: ${this.getAloneTimeStr()}`
    }
}

class UserList {
    constructor(db) {
        this.db = db;

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

    loadByCriteria(criteria) {
        this.list = [];
        const rows = this.db.prepare(`
            SELECT
                UserID,
                Username,
                VoiceTimeMS,
                JoinedTime,
                AloneTimeMS,
                AloneJoinedTime
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
                AloneJoinedTime
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
                    AloneJoinedTime = ?
                WHERE UserID = ?
            `).run(
                this.UserID,
                this.Username,
                this.VoiceTimeMS,
                this.JoinedTime,
                this.AloneTimeMS,
                this.AloneJoinedTime,
                this.UserID
            );
        } else {
            // Insert
            this.db.prepare(`
                INSERT INTO User (UserID, Username, VoiceTimeMS, JoinedTime, AloneTimeMS, AloneJoinedTime)
                VALUES
                    (?, ?, ?, ?, ?, ?)
            `).run(
                this.UserID,
                this.Username,
                this.VoiceTimeMS,
                this.JoinedTime,
                this.AloneTimeMS,
                this.AloneJoinedTime
            );
        }
    }
}

module.exports = {User, UserList};