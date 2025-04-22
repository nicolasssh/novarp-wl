const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');
const statusHandler = require('../../modules/whitelist/statusHandler');

module.exports = {
  execute(client, interaction) {
    // Ignorer si ce n'est pas un menu de sélection
    if (!interaction.isStringSelectMenu()) return;

    // Récupérer l'ID du menu
    const customId = interaction.customId;

    // Gérer les différents menus de sélection
    if (customId.startsWith('legal_status_')) {
      const userId = customId.split('_')[2];
      statusHandler.processLegalStatus(client, interaction, userId);
    }
    
    // Ajouter d'autres gestionnaires de menus si nécessaire
  }
};