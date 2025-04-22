const { ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');
const messageUtils = require('../../utils/messageUtils');
const formHandler = require('../../modules/whitelist/formHandler');
const requestHandler = require('../../modules/whitelist/requestHandler');
const interviewHandler = require('../../modules/whitelist/interviewHandler');

module.exports = {
  execute(client, interaction) {
    // Ignorer si ce n'est pas un bouton
    if (!interaction.isButton()) return;

    // Récupérer l'ID du bouton
    const customId = interaction.customId;

    // Gérer les différents boutons
    if (customId === 'request_wl') {
      requestHandler.createWhitelistChannel(client, interaction);
    } else if (customId === 'fill_form') {
      formHandler.showWhitelistForm(interaction);
    } else if (customId.startsWith('validate_wl_')) {
      const userId = customId.split('_')[2];
      interviewHandler.validateWhitelistRequest(client, interaction, userId, true);
    } else if (customId.startsWith('reject_wl_')) {
      const userId = customId.split('_')[2];
      interviewHandler.validateWhitelistRequest(client, interaction, userId, false);
    } else if (customId.startsWith('validate_interview_')) {
      const userId = customId.split('_')[2];
      interviewHandler.validateInterview(client, interaction, userId, true);
    } else if (customId.startsWith('reject_interview_')) {
      const userId = customId.split('_')[2];
      interviewHandler.validateInterview(client, interaction, userId, false);
    }
  }
};