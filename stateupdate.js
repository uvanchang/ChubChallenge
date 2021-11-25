const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const {User} = require("./user.js");

class StateUpdate {
    // StateUpdate Types
    static UNTRACKED = -1;
    static JOINING_CALL = 0;
    static LEAVING_CALL = 1;
    static TRANSFERING_CALL = 2;
    static DEAFENING = 3;
    static UNDEAFENING = 4;
    static GOING_AFK = 5;

    /**
     * @param {Discord.VoiceState} oldState 
     * @param {Discord.VoiceState} newState 
     */
    constructor(oldState, newState) {
        if (
            oldState.channelId == newState.channelId &&
            oldState.selfDeaf == newState.selfDeaf &&
            oldState.serverDeaf == newState.serverDeaf
        ) {
            // Only track following updates:
            // channel, deafen
            this.type = StateUpdate.UNTRACKED;
            return;
        }

        this.oldState = oldState;
        this.newState = newState;
        this.guild = oldState.guild;
    }

    async init() {
        let discordMember = await this.guild.members.fetch(this.oldState.id);
        this.user = new User(db, discordMember);

        if (this.oldState.channelId) {
            this.oldChannel = await this.guild.channels.fetch(this.oldState.channelId)
        }
    
        if (this.newState.channelId) {
            this.newChannel = await this.guild.channels.fetch(this.newState.channelId);
        }

        // Set type
        if (!this.oldState.deaf && this.newState.deaf) {
            this.type = StateUpdate.DEAFENING;
        } else if (this.oldState.deaf && !this.newState.deaf) {
            this.type = StateUpdate.UNDEAFENING;
        } else if (!this.oldChannel) {
            this.type = StateUpdate.JOINING_CALL;
        } else if (!this.newChannel) {
            this.type = StateUpdate.LEAVING_CALL;
        } else if (this.newChannel.id === this.guild.afkChannelId) {
            this.type = StateUpdate.GOING_AFK;
        } else {
            this.type = StateUpdate.TRANSFERING_CALL;
        }
    }

    handle() {
        switch (this.type) {
            case StateUpdate.JOINING_CALL:
                console.log(this.user.getUsername() + " joined a call");
                this.user.joinVoice();

                this.handleJoinAlone();

                break;

            case StateUpdate.LEAVING_CALL:
                console.log(this.user.getUsername() + " leaving a call");
                this.user.leaveVoice();
                this.user.leaveVoiceAlone();

                this.handleLeaveAlone();

                break;

            case StateUpdate.TRANSFERING_CALL:
                console.log(this.user.getUsername() + " joining another call");

                this.handleJoinAlone();
                this.handleLeaveAlone();
                
                break;

            case StateUpdate.DEAFENING:
                console.log(this.user.getUsername() + " deafening");
                this.user.leaveVoice();
                this.user.leaveVoiceAlone();

                break;

            case StateUpdate.UNDEAFENING:
                console.log(this.user.getUsername() + " undeafening");
                this.user.joinVoice();

                this.handleJoinAlone();

                break;

            case StateUpdate.GOING_AFK:
                console.log(this.user.getUsername() + " going AFK");
                this.user.leaveVoice();
                this.user.leaveVoiceAlone();

                break;

            default:
                console.log(this.user.getUsername() + " doing unknown action " + this.type);
                break;
        }
    }
    
    handleJoinAlone() {
        // Stop tracking alone time for user
        this.user.leaveVoiceAlone();

        if (this.newChannel.members.size == 1) {
            // Start tracking alone time if going between channels and new channel is 1
            this.user.joinVoiceAlone();
        } else if (this.newChannel.members.size == 2) {
            // Stop tracking alone time for other user
            let otherMember = this.newChannel.members.find(member => {
                return member.user.id !== this.user.getUserID();
            });
            if (!otherMember || otherMember.voice.deaf) {
                // No other member or the other member is deafened
                return;
            }

            let otherUser = new User(db, otherMember);
            otherUser.leaveVoiceAlone();
        }
    }

    handleLeaveAlone() {
        if (this.oldChannel.members.size == 1) {
            // Start tracking alone time for other user
            let otherMember = this.oldChannel.members.first();

            let otherUser = new User(db, otherMember);
            otherUser.joinVoiceAlone();
        }
    }
}

module.exports = {StateUpdate};