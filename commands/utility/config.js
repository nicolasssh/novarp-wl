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
    )
    .addRoleOption(option =>
        option.setName('default_role')
          .setDescription('Rôle par défaut attribué aux nouveaux membres')
          .setRequired(false)
    )
    .addStringOption(option =>
        option.setName('cat_new_requests')
          .setDescription('Nom de la catégorie pour les nouvelles demandes')
          .setRequired(false)
    )
    .addStringOption(option =>
        option.setName('cat_pending')
          .setDescription('Nom de la catégorie pour les demandes en attente de validation')
          .setRequired(false)
    )
    .addStringOption(option =>
        option.setName('cat_approved')
          .setDescription('Nom de la catégorie pour les demandes validées')
          .setRequired(false)
    )
    .addStringOption(option =>
        option.setName('cat_rejected')
          .setDescription('Nom de la catégorie pour les demandes refusées')
          .setRequired(false)
    ),
  
    async execute(interaction) {
        try {
          // Récupérer le canal sélectionné et les rôles
          const requestChannel = interaction.options.getChannel('request_channel');
          const staffWlRole = interaction.options.getRole('staff_wl_role');
          const validRequestRole = interaction.options.getRole('valid_request');
          const validWlRole = interaction.options.getRole('valid_wl');
          const defaultRole = interaction.options.getRole('default_role');
          
          // Récupérer les noms des catégories avec des valeurs par défaut
          const categoryNewRequests = interaction.options.getString('cat_new_requests') || '🔍 Demande de Whitelist';
          const categoryPending = interaction.options.getString('cat_pending') || '⏳ WL en attente de validation';
          const categoryApproved = interaction.options.getString('cat_approved') || '✅ WL validée';
          const categoryRejected = interaction.options.getString('cat_rejected') || '❌ WL refusée';
          
          // Récupérer l'ID du serveur
          const guildId = interaction.guild.id;
          
          // Créer un objet de configuration
          const configData = {
            guildId: guildId,
            requestChannelId: requestChannel.id,
            staffWlRoleId: staffWlRole.id,
            validRequestRoleId: validRequestRole.id,
            validWlRoleId: validWlRole.id,
            defaultRoleId: defaultRole ? defaultRole.id : null,
            categories: {
              newRequests: categoryNewRequests,
              pending: categoryPending,
              approved: categoryApproved,
              rejected: categoryRejected
            },
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
          
          // Confirmer la configuration
          await interaction.reply({
            content: `✅ Configuration mise à jour!\n
**Paramètres principaux :**
▸ Canal de demande de WL : ${requestChannel}
▸ Rôle minimum des douaniers : ${staffWlRole}
▸ Rôle validation du formulaire : ${validRequestRole}
▸ Rôle validation de WL : ${validWlRole}
▸ Rôle par défaut : ${defaultRole ? defaultRole : 'Non configuré'}

**Noms des catégories :**
▸ Nouvelles demandes : \`${categoryNewRequests}\`
▸ En attente de validation : \`${categoryPending}\`
▸ Demandes validées : \`${categoryApproved}\`
▸ Demandes refusées : \`${categoryRejected}\``,
            ephemeral: true
          });
        } catch (error) {
          console.error(`Erreur lors de la sauvegarde de la configuration:`, error);
          
          // Vérifier si l'interaction a déjà reçu une réponse
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "❌ Une erreur est survenue lors de la sauvegarde de la configuration.",
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors de la sauvegarde de la configuration.",
              ephemeral: true
            });
          }
        }
    }
};