class User {
    constructor(db, UserID) {
        this.user = new InternalUser(db);

        if (UserID) {
            this.user.loadByUserID(UserID);
        }
    }

    getVoiceTimeStr() {
        let milliseconds = Math.floor((this.user.VoiceTimeMS % 1000) / 100),
            seconds = Math.floor((this.user.VoiceTimeMS / 1000) % 60),
            minutes = Math.floor((this.user.VoiceTimeMS / (1000 * 60)) % 60),
            hours = Math.floor((this.user.VoiceTimeMS / (1000 * 60 * 60)) % 24);
        
        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;
        
        return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
    }

    joinVoice(discordUser) {
        this.user.Username = discordUser.username;
        this.user.JoinedTime = Date.now();

        this.user.InsertOrUpdate();
    }

    leaveVoice(discordUser) {
        if (!this.user.IsLoaded) {
            console.log(discordUser.username + " not loaded! Not adding voice time");
        } else if (this.user.JoinedTime == 0) {
            console.log(discordUser.username + " JoinedTime = 0! Not adding voice time");
        } else {
            let elapsedTime = Date.now() - this.user.JoinedTime
            this.user.VoiceTimeMS += elapsedTime;
            console.log("Adding " + elapsedTime + " ms to " + discordUser.username + " VoiceTimeMS for total of " + this.user.VoiceTimeMS + " ms");
        }

        this.user.Username = discordUser.username;
        this.user.JoinedTime = 0;

        this.user.InsertOrUpdate();
    }

    resetJoinedTime() {
        if (!this.user.IsLoaded) {
            return;
        }

        this.user.JoinedTime = 0;

        this.user.InsertOrUpdate();
    }
}

class UserList {
    constructor(db) {
        this.db = db;

        this.list = [];
    }

    loadByNonZeroJoinedTime() {
        this.loadByCriteria("WHERE JoinedTime != 0");
    }

    loadByTop5() {
        this.loadByCriteria("ORDER BY VoiceTimeMS DESC LIMIT 5");
    }

    loadByCriteria(criteria) {
        this.list = [];
        const rows = this.db.prepare(`
            SELECT
                UserID,
                Username,
                VoiceTimeMS,
                JoinedTime
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

        this.IsLoaded = false;
    }
    
    loadByUserID(userID) {
        this.UserID = userID;
        const row = this.db.prepare(`
            SELECT
                UserID,
                Username,
                VoiceTimeMS,
                JoinedTime
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
                    JoinedTime = ?
                WHERE UserID = ?
            `).run(
                this.UserID,
                this.Username,
                this.VoiceTimeMS,
                this.JoinedTime,
                this.UserID
            );
        } else {
            // Insert
            this.db.prepare(`
                INSERT INTO User (UserID, Username, VoiceTimeMS, JoinedTime)
                VALUES
                    (?, ?, ?, ?)
            `).run(
                this.UserID,
                this.Username,
                this.VoiceTimeMS,
                this.JoinedTime
            );
        }
    }
}

module.exports = {User, UserList};