function getFormattedTime(timeMS) {
    let seconds = Math.floor((timeMS / 1000) % 60),
        minutes = Math.floor((timeMS / (1000 * 60)) % 60),
        hours = Math.floor((timeMS / (1000 * 60 * 60)) % 24),
        days = Math.floor((timeMS / (1000 * 60 * 60 * 24)));
    
    days = (days < 10) ? "0" + days : days;
    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    getFormattedTime: getFormattedTime,
};