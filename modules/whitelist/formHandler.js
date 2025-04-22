const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, Colors } = require('discord.js');
const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');

// Afficher le formulaire de whitelist
async function showWhitelistForm(interaction) {
  try {
    // Créer la modale
    const modal = new ModalBuilder()
      .setCustomId('wl_form_modal')
      .setTitle('Formulaire de Whitelist');

    // Champ pour le nom du personnage
    const nomInput = new TextInputBuilder()
      .setCustomId('nom_personnage')
      .setLabel('Nom du personnage')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    // Champ pour le prénom du personnage
    const prenomInput = new TextInputBuilder()
      .setCustomId('prenom_personnage')
      .setLabel('Prénom du personnage')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    // Champ pour le lien du background
    const backgroundInput = new TextInputBuilder()
      .setCustomId('background_link')
      .setLabel('Lien du background')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://')
      .setRequired(true);

    // Création des rangées ActionRow pour chaque input
    const nomRow = new ActionRowBuilder().addComponents(nomInput);
    const prenomRow = new ActionRowBuilder().addComponents(prenomInput);
    const backgroundRow = new ActionRowBuilder().addComponents(backgroundInput);

    // Ajout des rangées à la modale
    modal.addComponents(nomRow, prenomRow, backgroundRow);

    // Afficher la modale à l'utilisateur
    await interaction.showModal(modal);

  } catch (error) {
    logger.error(`Erreur lors de l'affichage de la modale`, error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "Désolé, une erreur s'est produite lors de l'affichage du formulaire. Veuillez réessayer plus tard.",
        ephemeral: true
      });
    }
  }
}

// Traiter la soumission du formulaire
async function processFormSubmission(client, interaction) {
  try {
    // Récupérer les valeurs soumises
    const nom = interaction.fields.getTextInputValue('nom_personnage');
    const prenom = interaction.fields.getTextInputValue('prenom_personnage');
    const backgroundLink = interaction.fields.getTextInputValue('background_link');

    // Répondre à l'interaction de manière éphémère pour confirmer la soumission
    await interaction.reply({
      content: 'Formulaire soumis avec succès! Veuillez maintenant choisir si votre personnage est légal ou illégal.',
      ephemeral: true
    });

    // Créer un menu pour choisir légal ou illégal
    const legalSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`legal_status_${interaction.user.id}`)  // On stocke l'ID de l'utilisateur pour le retrouver après
      .setPlaceholder('Sélectionnez le statut légal de votre personnage')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Légal')
          .setValue('legal')
          .setDescription('Personnage respectant les lois')
          .setEmoji('✅'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Illégal')
          .setValue('illegal')
          .setDescription('Personnage du côté obscur')
          .setEmoji('🚫')
      );

    const selectRow = new ActionRowBuilder().addComponents(legalSelectMenu);

    // Stocker temporairement les données du formulaire
    if (!client.formData) client.formData = new Map();
    client.formData.set(interaction.user.id, {
      nom,
      prenom,
      backgroundLink,
      channelId: interaction.channelId
    });

    // Envoyer le menu dans le canal
    await interaction.channel.send({
      content: `<@${interaction.user.id}>, veuillez sélectionner le statut légal de votre personnage:`,
      components: [selectRow]
    });

  } catch (error) {
    logger.error(`Erreur lors du traitement de la soumission du formulaire`, error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "Désolé, une erreur s'est produite lors du traitement de votre formulaire. Veuillez réessayer plus tard.",
        ephemeral: true
      });
    }
  }
}

// Exporter les fonctions
module.exports = {
  showWhitelistForm,
  processFormSubmission
};