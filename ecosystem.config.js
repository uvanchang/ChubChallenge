module.exports = {
  apps : [{
    name   : "chubchallenge",
    script : "./bot.js",
    watch: true,
    ignore_watch: [".git", "node_modules", "data"],
    log_date_format: "YYYY-MM-DD HH:mm Z",
  }]
}
