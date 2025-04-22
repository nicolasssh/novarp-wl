const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { setGuildConfigured } = require('../../utils/configManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurate the bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option => 
      option.setName('request_channel')
        .setDescription('Choisissez le canal pour les demandes de WL')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addRoleOption(option =>
        option.setName('staff_wl_role')
          .setDescription('Choisissez le rôle minimum pouvant gérer les wl')
          .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('valid_request')
          .setDescription('Choisissez le rôle de validation du formulaire WL')
          .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('valid_wl')
          .setDescription('Choisissez le rôle de validation de WL')
          .setRequired(true)
    ),
  
    async execute(interaction) {
        try {
          // Récupérer le canal sélectionné et les rôles
          const requestChannel = interaction.options.getChannel('request_channel');
          const staffWlRole = interaction.options.getRole('staff_wl_role');
          const validRequestRole = interaction.options.getRole('valid_request');
          const validWlRole = interaction.options.getRole('valid_wl');
          
          // Récupérer l'ID du serveur
          const guildId = interaction.guild.id;
          
          // Créer un objet de configuration
          const configData = {
            guildId: guildId,
            requestChannelId: requestChannel.id,
            staffWlRoleId: staffWlRole.id,
            validRequestRoleId: validRequestRole.id,
            validWlRoleId: validWlRole.id,
            updatedAt: new Date().toISOString(),
            updatedBy: interaction.user.id
          };
          
          // Créer le dossier config s'il n'existe pas
          const configDir = path.join(__dirname, '..', '..', 'config');
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          
          // Chemin du fichier de configuration
          const configFilePath = path.join(configDir, `config_${guildId}.json`);
          
          // Écrire les données dans le fichier JSON
          fs.writeFileSync(configFilePath, JSON.stringify(configData, null, 2), 'utf8');
          setGuildConfigured(guildId, true);
          
          // Confirmer la configuration avec flags au lieu de ephemeral
          await interaction.reply({
            content: `✅ Configuration mise à jour!\nLe canal de demande de WL est : ${requestChannel}\nLe role minimum des douaniers est: ${staffWlRole}\nLe role de validation du formulaire WL est: ${validRequestRole}\nLe role de validation de WL est: ${validWlRole}`,
            flags: 64  // Utiliser flags: 64 au lieu de ephemeral: true
          });
        } catch (error) {
          console.error(`Erreur lors de la sauvegarde de la configuration:`, error);
          
          // Vérifier si l'interaction a déjà reçu une réponse
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "❌ Une erreur est survenue lors de la sauvegarde de la configuration.",
              flags: 64
            });
          } else {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors de la sauvegarde de la configuration.",
              flags: 64
            });
          }
        }
    }
};