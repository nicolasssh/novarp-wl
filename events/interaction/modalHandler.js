const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');
const formHandler = require('../../modules/whitelist/formHandler');

module.exports = {
  execute(client, interaction) {
    // Ignorer si ce n'est pas une soumission de modale
    if (!interaction.isModalSubmit()) return;

    // Récupérer l'ID de la modale
    const customId = interaction.customId;

    // Gérer les différentes modales
    if (customId === 'wl_form_modal') {
      formHandler.processFormSubmission(client, interaction);
    }
    
    // Ajouter d'autres gestionnaires de modales si nécessaire
  }
};