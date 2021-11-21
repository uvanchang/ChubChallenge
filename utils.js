const db = require('better-sqlite3')('./data/myData.db');
const {User, UserList} = require("./user.js");

function refreshCCStats() {
    let users = new UserList(db);
    users.loadByNonZeroJoinedTime();

    users.list.forEach(user => {
        user.refreshStats();
    });
}

module.exports = {
    refreshCCStats,
};