const fs = require('node:fs');
const path = require('node:path');
const { 
    Client, 
    Collection,
    Events, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    EmbedBuilder, 
    Colors, 
    PermissionsBitField, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    ChannelType,
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.APP_TOKEN;
const clientId = process.env.CLIENT_ID;

// Fonctions de logging
const logInfo = (message) => console.log(`[INFO] ${message}`);
const logWarning = (message) => console.log(`[WARNING] ${message}`);
const logError = (message, error) => {
    console.error(`[ERROR] ${message}`);
    if (error) console.error(error);
};

// Créer le client Discord
const client = new Client({ 
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ] 
});

client.commands = new Collection();

// Import des utilitaires de configuration
try {
  const configManagerPath = path.join(__dirname, 'utils', 'configManager.js');
  
  if (!fs.existsSync(configManagerPath)) {
    logError("Le fichier configManager.js est introuvable.");
    process.exit(1);
  }
  
  const { 
    isGuildConfigured, 
    getGuildConfig, 
    setGuildConfigured, 
    configEvents,
    configuredGuilds 
  } = require('./utils/configManager');
} catch (error) {
  logError("Erreur lors de l'importation du gestionnaire de configuration", error);
  process.exit(1);
}

// Import du gestionnaire de configuration
const { 
  isGuildConfigured, 
  getGuildConfig, 
  setGuildConfigured, 
  configEvents,
  configuredGuilds 
} = require('./utils/configManager');

// Chargement des commandes
const foldersPath = path.join(__dirname, 'commands');

if (!fs.existsSync(foldersPath)) {
  logError("Le dossier de commandes est introuvable.");
  process.exit(1);
}

const commandFolders = fs.readdirSync(foldersPath);

// Array pour stocker les commandes JSON pour le déploiement
const commandsJson = [];

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  
  if (!fs.existsSync(commandsPath)) {
    continue;
  }
  
  if (!fs.statSync(commandsPath).isDirectory()) {
    continue;
  }
  
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    
    try {
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsJson.push(command.data.toJSON());
      } else {
        logWarning(`La commande ${filePath} n'a pas les propriétés requises 'data' ou 'execute'.`);
      }
    } catch (error) {
      logError(`Erreur lors du chargement de la commande ${filePath}`, error);
    }
  }
}

// Fonction pour déployer les commandes sur un serveur spécifique
async function deployCommands(guildId) {
  const rest = new REST().setToken(token);
  
  try {
    logInfo(`Déploiement des commandes pour le serveur ${guildId}`);
    
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commandsJson },
    );
    
    logInfo(`${data.length} commandes déployées avec succès sur ${guildId}`);
    return true;
  } catch (error) {
    logError(`Erreur lors du déploiement des commandes sur ${guildId}`, error);
    return false;
  }
}

// Événement quand le bot est ajouté à un nouveau serveur
client.on(Events.GuildCreate, async guild => {
  logInfo(`Bot ajouté au serveur: ${guild.name} (${guild.id})`);
  
  // Vérifier les permissions du bot dans ce serveur
  const me = guild.members.me;
  if (!me) {
    logError(`Impossible de récupérer l'objet membre du bot sur ${guild.name}`);
    return;
  }
    
  // Déployer les commandes sur ce nouveau serveur
  const deploySuccess = await deployCommands(guild.id);
  
  if (!deploySuccess) {
    logError(`Échec du déploiement des commandes sur ${guild.name}`);
  }
  
  // Envoyer un message d'accueil
  try {
    // Trouver un canal où le bot peut envoyer des messages
    
    const systemChannel = guild.systemChannel;
    const generalChannel = guild.channels.cache.find(channel => 
      (channel.name.includes('général') || channel.name.includes('general')) && channel.isTextBased()
    );
    const firstTextChannel = guild.channels.cache.find(channel => channel.isTextBased());
    
    // Utiliser le premier canal disponible dans cet ordre
    const targetChannel = systemChannel || generalChannel || firstTextChannel;
    
    if (targetChannel) {      
      // Vérifier les permissions dans ce canal
      const permissions = targetChannel.permissionsFor(me);
      if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
        logWarning(`Pas de permission d'envoi de messages dans ${targetChannel.name} sur ${guild.name}`);
        return;
      }
      
      const welcomeEmbed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('👋 Bonjour!')
        .setDescription(`Merci de m'avoir ajouté à votre serveur **${guild.name}**!`)
        .addFields(
          { name: '🔧 Configuration', value: 'Maintenant configurons le module avec la commande `/config`' }
        )
        .setFooter({ text: 'Merci de votre confiance!' })
        .setTimestamp();
      
      // Envoyer l'embed
      await targetChannel.send({ embeds: [welcomeEmbed] });
    } else {
      logWarning(`Aucun canal trouvé pour envoyer le message d'accueil sur ${guild.name}`);
    }
  } catch (error) {
    logError(`Erreur lors de l'envoi du message d'accueil sur ${guild.name}`, error);
  }
});

// Gestion des interactions de commande
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  const commandName = interaction.commandName;
  
  const command = interaction.client.commands.get(commandName);
  if (!command) {
    return;
  }
  
  // Vérifier la configuration sauf pour la commande config elle-même
  if (commandName !== 'config' && !isGuildConfigured(interaction.guild.id)) {
    return interaction.reply({
      content: '⚠️ Ce serveur n\'a pas encore été configuré. Veuillez utiliser la commande `/config` d\'abord.',
      ephemeral: true
    });
  }
  
  try {
    await command.execute(interaction);
  } catch (error) {
    logError(`Erreur lors de l'exécution de la commande ${commandName}`, error);
    
    // Répondre à l'utilisateur
    try {
      const errorResponse = { 
        content: 'Une erreur est survenue lors de l\'exécution de cette commande!', 
        ephemeral: true
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    } catch (replyError) {
      logError(`Erreur lors de la réponse à l'erreur de commande`, replyError);
    }
  }
});

// Événement quand le bot est prêt
client.once(Events.ClientReady, readyClient => {
  logInfo(`Connecté en tant que ${readyClient.user.tag}`);
  
  // Déployer les commandes sur tous les serveurs existants
  const guilds = client.guilds.cache;
  
  guilds.forEach(async guild => {
    await deployCommands(guild.id);
    
    const configured = isGuildConfigured(guild.id);
    configuredGuilds.set(guild.id, configured);
    
    // Log des permissions du bot sur ce serveur
    const me = guild.members.me;
    if (me) {
      logInfo(`Permissions sur ${guild.name}: ${me.permissions.toArray().join(', ')}`);
    }
  });
});

// Gestion de l'événement de configuration terminée
configEvents.on('guildConfigured', async (guildId, config) => {
  console.log(`[DEBUG] Événement guildConfigured reçu pour ${guildId}`);
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logWarning(`Événement guildConfigured reçu pour un serveur inconnu: ${guildId}`);
    return;
  }
  logInfo(`Configuration terminée pour le serveur ${guild.name} (${guildId})`);
    
  try {
    if (!config) {
      logWarning(`Configuration manquante pour le serveur ${guild.name}`);
      return;
    }
    logInfo(`Configuration: ${JSON.stringify(config)}`);
        
    const requestChannelId = config.requestChannelId;
    if (!requestChannelId) {
      logWarning(`ID de canal manquant dans la configuration de ${guild.name}`);
      return;
    }
    
    const channel = guild.channels.cache.get(requestChannelId);
    if (!channel) {
      logWarning(`Canal ${requestChannelId} non trouvé sur ${guild.name}`);
      return;
    }
    logInfo(`Canal de requêtes configuré: ${channel.name} (${channel.id})`);
        
    // Vérifier les permissions avant d'envoyer
    const me = guild.members.me;
    if (!me) {
      logError(`Impossible de récupérer l'objet membre du bot sur ${guild.name}`);
      return;
    }
    
    const permissions = channel.permissionsFor(me);
    logInfo(`Permissions du bot dans le canal ${channel.name}: ${permissions.toArray().join(', ')}`);
    
    if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
      logWarning(`Le bot n'a pas la permission d'envoyer des messages dans le canal ${channel.name}`);
      
      // Tenter de trouver un canal alternatif pour informer l'utilisateur
      const fallbackChannel = guild.channels.cache.find(c => 
        c.isTextBased() && c.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages)
      );
      
      if (fallbackChannel) {
        logInfo(`Envoi d'un message d'avertissement dans le canal alternatif: ${fallbackChannel.name}`);
        await fallbackChannel.send({
          content: `⚠️ Je n'ai pas la permission d'envoyer des messages dans le canal <#${channel.id}> que vous avez configuré. Veuillez vérifier mes permissions.`
        });
      }
      return;
    }
    
    const configSuccessEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Demandez votre whitelist')
        .setDescription('Cliquez sur le bouton ci-dessous pour faire une demande de whitelist')
        .addFields(
            { name: 'Remplissez le formulaire', value: `Remplissez le formulaire qui vous sera envoyé dans votre channel !` },
            { name: 'Attendez une validation', value: `Un douanier validera votre formulaire.` },
            { name: 'Passez l\'entretien', value: 'Une fois le formulaire validé, passez un entretien avec un douanier pour avoir votre whitelist !' }
        )

    // Créer un bouton
    const guideButton = new ButtonBuilder()
        .setCustomId('request_wl')
        .setLabel('Demandez votre whitelist')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✅');

    // Créer une ligne pour les boutons
    const row = new ActionRowBuilder().addComponents(guideButton);

    // Envoyer le message avec l'embed et le bouton
    await channel.send({
        embeds: [configSuccessEmbed],
        components: [row]
    });
    logInfo(`Message de confirmation envoyé dans ${channel.name} sur ${guild.name}`);
    
  } catch (error) {
    logError(`Erreur lors des actions post-configuration pour ${guild.name}`, error);
  }
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logError('Promesse rejetée non gérée', reason);
});

process.on('uncaughtException', (error) => {
  logError('Exception non capturée', error);
  // Généralement, il est conseillé de fermer le processus après une exception non capturée
  // Mais ici, nous allons continuer pour éviter un arrêt brutal du bot
});

// ------------------- GESTIONNAIRES D'ÉVÉNEMENTS POUR LES INTERACTIONS -------------------

// Gestionnaire pour le bouton "Demander une whitelist"
client.on('interactionCreate', async interaction => {
    // Vérifier si l'interaction est un bouton et si c'est le bon bouton
    if (!interaction.isButton() || interaction.customId !== 'request_wl') return;
  
    try {
      // Obtenir les informations sur l'utilisateur et la guilde
      const guild = interaction.guild;
      const user = interaction.user;
      const member = interaction.member;
  
      // Récupérer la configuration du serveur
      const guildConfig = getGuildConfig(guild.id);
      if (!guildConfig) {
        logWarning(`Configuration manquante pour le serveur ${guild.name}`);
        await interaction.reply({
          content: "❌ Erreur: Configuration du serveur manquante. Veuillez contacter un administrateur.",
          ephemeral: true
        });
        return;
      }
  
      // Récupérer le nom de la catégorie depuis la configuration
      const categoryName = guildConfig.categories?.newRequests || '🔍 Demande de Whitelist';
  
      // Générer un ID aléatoire de 5 caractères
      const randomId = Math.random().toString(36).substring(2, 7);
      
      // Nom du nouveau canal
      const channelName = `${randomId}-wl-${user.username}`;
      
      // Trouver ou créer la catégorie pour les nouvelles demandes
      let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === categoryName
      );
      
      // Si la catégorie n'existe pas, la créer
      if (!category) {
        logInfo(`Création de la catégorie "${categoryName}" sur ${guild.name}`);
        
        // Lors de la création des catégories et des canaux, ajouter des permissions pour tous les rôles au-dessus de staffWlRoleId
        const staffRole = interaction.guild.roles.cache.get(guildConfig.staffWlRoleId);
        if (!staffRole) {
          await interaction.reply({
            content: "❌ Le rôle de modérateur configuré est introuvable sur ce serveur.",
            ephemeral: true
          });
          return;
        }
        
        // Récupérer tous les rôles au-dessus de staffWlRoleId
        const higherRoles = interaction.guild.roles.cache.filter(role => role.position > staffRole.position);
        
        // Ajouter les permissions pour ces rôles lors de la création des catégories et des canaux
        const permissionOverwrites = [
          {
            id: interaction.guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          ...higherRoles.map(role => ({
            id: role.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }))
        ];
        
        // Utiliser ces permissions lors de la création des catégories et des canaux
        category = await guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory,
          permissionOverwrites
        });
      }

      const staffRole = interaction.guild.roles.cache.get(guildConfig.staffWlRoleId);
      if (!staffRole) {
        await interaction.reply({
          content: "❌ Le rôle de modérateur configuré est introuvable sur ce serveur.",
          ephemeral: true
        });
        return;
      }
      
      // Récupérer tous les rôles au-dessus de staffWlRoleId
      const higherRoles = interaction.guild.roles.cache.filter(role => role.position > staffRole.position);
      
      // Créer le canal avec les permissions appropriées
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: user.id, // L'utilisateur qui a cliqué
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          {
            id: guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          {
            id: staffRole.id, // Rôle staffWlRoleId
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          ...higherRoles.map(role => ({
            id: role.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }))
        ]
      });
      
      // Répondre à l'interaction pour éviter l'erreur "Interaction has already been acknowledged"
      await interaction.reply({
        content: `Votre demande de whitelist a été créée dans le canal ${channel}`,
        ephemeral: true
      });
      
      // Envoyer un message dans le nouveau canal et taguer l'utilisateur
      const welcomeEmbed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('🔍 Demande de Whitelist')
        .setDescription(`Bonjour ${user}, merci pour votre demande de whitelist!`)
        .addFields(
          { name: 'Instructions', value: 'Veuillez remplir le formulaire ci-dessous pour votre demande de whitelist.' }
        );
        
      // Vous pouvez ajouter ici un bouton ou des champs pour le formulaire
      const formButton = new ButtonBuilder()
        .setCustomId('fill_form')
        .setLabel('Remplir le formulaire')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝');
        
      const row = new ActionRowBuilder().addComponents(formButton);
      
      await channel.send({
        content: `<@${user.id}>, voici votre formulaire de demande de whitelist:`,
        embeds: [welcomeEmbed],
        components: [row]
      });
      
      logInfo(`Canal de demande de whitelist créé: ${channelName} pour l'utilisateur ${user.tag}`);
            
    } catch (error) {      
      logError(`Erreur lors de la création du canal de demande de whitelist`, error);
      
      // Informer l'utilisateur en cas d'erreur
      if (!interaction.replied) {
        await interaction.reply({
          content: "Désolé, une erreur s'est produite lors de la création de votre demande de whitelist. Veuillez réessayer plus tard.",
          ephemeral: true
        });
      }
    }
});

// Gestionnaire pour le bouton "Remplir le formulaire"
client.on('interactionCreate', async interaction => {
    // Vérifier si l'interaction est un bouton et si c'est le bon bouton
    if (!interaction.isButton() || interaction.customId !== 'fill_form') return;
  
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
  
      // Pour la sélection légal/illégal, on va l'ajouter après soumission car les modales ne supportent pas les radio buttons
  
      // Création des rangées ActionRow pour chaque input
      const nomRow = new ActionRowBuilder().addComponents(nomInput);
      const prenomRow = new ActionRowBuilder().addComponents(prenomInput);
      const backgroundRow = new ActionRowBuilder().addComponents(backgroundInput);
  
      // Ajout des rangées à la modale
      modal.addComponents(nomRow, prenomRow, backgroundRow);
  
      // Afficher la modale à l'utilisateur
      await interaction.showModal(modal);
  
    } catch (error) {
      logError(`Erreur lors de l'affichage de la modale`, error);
      if (!interaction.replied) {
        await interaction.reply({
          content: "Désolé, une erreur s'est produite lors de l'affichage du formulaire. Veuillez réessayer plus tard.",
          ephemeral: true
        });
      }
    }
  });
  
// Gestionnaire pour la soumission de la modale
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'wl_form_modal') return;
  
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
  
      // Stocker temporairement les données du formulaire (dans une map ou une base de données)
      // Pour cet exemple, on va utiliser une map en mémoire
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
      logError(`Erreur lors du traitement de la soumission du formulaire`, error);
      if (!interaction.replied) {
        await interaction.reply({
          content: "Désolé, une erreur s'est produite lors du traitement de votre formulaire. Veuillez réessayer plus tard.",
          ephemeral: true
        });
      }
    }
  });
  
// Gestionnaire pour la sélection légal/illégal
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    
    // Vérifier si c'est une sélection de statut légal
    if (!interaction.customId.startsWith('legal_status_')) return;
    
    try {
      // Extraire l'ID de l'utilisateur du customId
      const userId = interaction.customId.split('_')[2];
      
      // Vérifier si c'est bien l'utilisateur concerné qui répond
      if (userId !== interaction.user.id) {
        await interaction.reply({
          content: "Ce menu ne vous est pas destiné.",
          ephemeral: true
        });
        return;
      }
      
      // Récupérer le choix légal/illégal
      const legalStatus = interaction.values[0]; // 'legal' ou 'illegal'
      
      // Récupérer les données du formulaire stockées précédemment
      if (!client.formData || !client.formData.has(userId)) {
        await interaction.reply({
          content: "Désolé, vos données de formulaire n'ont pas été trouvées. Veuillez réessayer.",
          ephemeral: true
        });
        return;
      }
      
      const formData = client.formData.get(userId);
      // Ajouter le statut légal aux données
      formData.legalStatus = legalStatus;
      
      // Récupérer la configuration du serveur
      const guildConfig = getGuildConfig(interaction.guild.id);
      if (!guildConfig) {
        logWarning(`Configuration manquante pour le serveur ${interaction.guild.name}`);
        await interaction.reply({
          content: "❌ Erreur: Configuration du serveur manquante. Veuillez contacter un administrateur.",
          ephemeral: true
        });
        return;
      }
      
      // Créer l'embed pour afficher les réponses
      const responseEmbed = new EmbedBuilder()
        .setColor(legalStatus === 'legal' ? Colors.Green : Colors.Red)
        .setTitle('📝 Formulaire de Whitelist soumis')
        .addFields(
          { name: 'Nom', value: formData.nom, inline: true },
          { name: 'Prénom', value: formData.prenom, inline: true },
          { name: 'Statut', value: legalStatus === 'legal' ? '✅ Légal' : '🚫 Illégal', inline: true },
          { name: 'Background', value: `[Lien vers le background](${formData.backgroundLink})` }
        )
        .setFooter({ text: `Demande soumise par ${interaction.user.tag}` })
        .setTimestamp();
      
      // Vérifier que le rôle de validation existe
      if (!guildConfig.staffWlRoleId) {
        logWarning(`Configuration du rôle modérateur manquante pour le serveur ${interaction.guild.name}`);
      }
      
      // Créer les boutons de validation/refus
      const validateButton = new ButtonBuilder()
        .setCustomId(`validate_wl_${userId}`)
        .setLabel('Valider')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');
        
      const rejectButton = new ButtonBuilder()
        .setCustomId(`reject_wl_${userId}`)
        .setLabel('Refuser')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');
      
      const buttonsRow = new ActionRowBuilder().addComponents(validateButton, rejectButton);
      
      // Envoyer l'embed dans le canal avec les boutons
      await interaction.update({ 
        content: `<@${userId}>, votre formulaire a été soumis avec succès! Un modérateur va l'examiner prochainement.`,
        components: [buttonsRow],
        embeds: [responseEmbed]
      });
      
      // Obtenir l'objet canal
      const channel = interaction.channel;
      const guild = interaction.guild;
      
      // Récupérer le nom de la catégorie depuis la configuration
      const categoryPendingName = guildConfig.categories?.pending || '⏳ WL en attente de validation';
      
      // Créer ou trouver la catégorie "En attente de validation"
      let waitingCategory = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === categoryPendingName
      );
      
      if (!waitingCategory) {
        // Lors de la création des catégories et des canaux, ajouter des permissions pour tous les rôles au-dessus de staffWlRoleId
        const staffRole = interaction.guild.roles.cache.get(guildConfig.staffWlRoleId);
        if (!staffRole) {
          await interaction.reply({
            content: "❌ Le rôle de modérateur configuré est introuvable sur ce serveur.",
            ephemeral: true
          });
          return;
        }
        
        // Récupérer tous les rôles au-dessus de staffWlRoleId
        const higherRoles = interaction.guild.roles.cache.filter(role => role.position > staffRole.position);
        
        // Ajouter les permissions pour ces rôles lors de la création des catégories et des canaux
        const permissionOverwrites = [
          {
            id: interaction.guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          ...higherRoles.map(role => ({
            id: role.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }))
        ];
        
        // Utiliser ces permissions lors de la création des catégories et des canaux
        waitingCategory = await guild.channels.create({
          name: categoryPendingName,
          type: ChannelType.GuildCategory,
          permissionOverwrites
        });
      }
      
      // Déplacer le canal vers la nouvelle catégorie
      await channel.setParent(waitingCategory.id, { 
        lockPermissions: false // Ne pas synchroniser les permissions avec la catégorie
      });
      
      // Supprimer les données temporaires
      client.formData.delete(userId);
      
      logInfo(`Formulaire de whitelist soumis par ${interaction.user.tag} dans ${channel.name}`);
      
    } catch (error) {
      logError(`Erreur lors du traitement de la sélection légal/illégal`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Désolé, une erreur s'est produite lors du traitement de votre sélection. Veuillez réessayer plus tard.",
          ephemeral: true
        });
      }
    }
  });
  
// Gestionnaire pour les boutons de validation/refus
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    // Vérifier si c'est un bouton de validation ou de refus
    if (!interaction.customId.startsWith('validate_wl_') && !interaction.customId.startsWith('reject_wl_')) return;
    
    try {
      // Récupérer l'ID de l'utilisateur concerné
      const userId = interaction.customId.split('_')[2];
      
      // Récupérer la configuration du serveur
      const guildConfig = getGuildConfig(interaction.guild.id);
      if (!guildConfig) {
        await interaction.reply({
          content: "❌ Erreur: Configuration du serveur manquante. Veuillez contacter un administrateur.",
          ephemeral: true
        });
        return;
      }
      
      if (!guildConfig.staffWlRoleId) {
        await interaction.reply({
          content: "❌ La configuration du rôle modérateur est manquante sur ce serveur.",
          ephemeral: true
        });
        return;
      }
      
      // Vérifier si l'utilisateur a au moins le rôle staffWlRoleId ou un rôle supérieur
      const staffRole = interaction.guild.roles.cache.get(guildConfig.staffWlRoleId);
      if (!staffRole) {
        await interaction.reply({
          content: "❌ Le rôle de modérateur configuré est introuvable sur ce serveur.",
          ephemeral: true
        });
        return;
      }
      
      const hasRequiredRole = interaction.member.roles.cache.some(role => role.position >= staffRole.position);
      if (!hasRequiredRole) {
        await interaction.reply({
          content: "❌ Vous n'avez pas la permission d'utiliser ce bouton. Seuls les modérateurs ou utilisateurs avec un rôle supérieur peuvent valider ou refuser les demandes.",
          ephemeral: true
        });
        return;
      }
      
      const isValidation = interaction.customId.startsWith('validate_wl_');
      const action = isValidation ? "validée" : "refusée";
      const emoji = isValidation ? "✅" : "❌";
      const color = isValidation ? Colors.Green : Colors.Red;
      
      // Créer l'embed de réponse
      const responseEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} Demande ${action}`)
        .setDescription(`La demande de whitelist a été ${action} par <@${interaction.user.id}>.`)
        .setFooter({ text: `Modérateur: ${interaction.user.tag}` })
        .setTimestamp();
      
      // Mettre à jour le message avec le nouvel embed et retirer les boutons de validation/refus
      // Si c'est une validation, on va ajouter de nouveaux boutons pour l'entretien
      if (isValidation) {
        // Créer les boutons d'entretien
        const validateInterviewButton = new ButtonBuilder()
          .setCustomId(`validate_interview_${userId}`)
          .setLabel('Valider l\'entretien')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅');
          
        const rejectInterviewButton = new ButtonBuilder()
          .setCustomId(`reject_interview_${userId}`)
          .setLabel('Refuser l\'entretien')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌');
        
        const interviewButtonsRow = new ActionRowBuilder().addComponents(validateInterviewButton, rejectInterviewButton);
        
        await interaction.update({
          content: `<@${userId}>, votre demande de whitelist a été approuvée! 🎉 Un modérateur va maintenant procéder à l'entretien.`,
          components: [interviewButtonsRow],
          embeds: [responseEmbed]
        });
      } else {
        // Si c'est un refus, on retire tous les boutons
        await interaction.update({
          content: `<@${userId}>, votre demande de whitelist a été refusée.`,
          components: [],
          embeds: [responseEmbed]
        });
      }
      
      // Obtenir l'objet canal
      const channel = interaction.channel;
      
      // Récupérer les noms des catégories depuis la configuration
      const categoryApprovedName = guildConfig.categories?.approved || '✅ WL validée';
      const categoryRejectedName = guildConfig.categories?.rejected || '❌ WL refusée';
      
      if (isValidation) {
        // Si validé, déplacer vers la catégorie des demandes validées (à créer si nécessaire)
        let validatedCategory = interaction.guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name === categoryApprovedName
        );
        
        if (!validatedCategory) {
          // Lors de la création des catégories et des canaux, ajouter des permissions pour tous les rôles au-dessus de staffWlRoleId
          const staffRole = interaction.guild.roles.cache.get(guildConfig.staffWlRoleId);
          if (!staffRole) {
            await interaction.reply({
              content: "❌ Le rôle de modérateur configuré est introuvable sur ce serveur.",
              ephemeral: true
            });
            return;
          }
          
          // Récupérer tous les rôles au-dessus de staffWlRoleId
          const higherRoles = interaction.guild.roles.cache.filter(role => role.position > staffRole.position);
          
          // Ajouter les permissions pour ces rôles lors de la création des catégories et des canaux
          const permissionOverwrites = [
            {
              id: interaction.guild.id, // @everyone
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: interaction.guild.members.me.id, // Le bot
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            },
            ...higherRoles.map(role => ({
              id: role.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }))
          ];
          
          // Utiliser ces permissions lors de la création des catégories et des canaux
          validatedCategory = await interaction.guild.channels.create({
            name: categoryApprovedName,
            type: ChannelType.GuildCategory,
            permissionOverwrites
          });
        }
        
        await channel.setParent(validatedCategory.id, { lockPermissions: false });
        
        // Envoyer un message de suivi
        await channel.send({
          content: `<@${userId}>, félicitations! Votre formulaire de whitelist a été validé. Un modérateur va maintenant procéder à l'entretien.`
        });
        
        // Trouver le membre et lui ajouter le rôle
        // Dans la partie où vous traitez les boutons de validation/refus, vers la ligne 867
        try {
            // Récupérer l'objet guild à partir de l'interaction
            const guild = interaction.guild;
            const userMember = await guild.members.fetch(userId);
            
            if (guildConfig.validRequestRoleId) {
            // Récupérer le rôle à ajouter
            const roleToAdd = guild.roles.cache.get(guildConfig.validRequestRoleId);
            
            // Vérification détaillée du rôle
            if (!roleToAdd) {
                await channel.send({
                content: `⚠️ Erreur: Le rôle avec l'ID ${guildConfig.validRequestRoleId} n'existe pas.`
                });
                return;
            }
            
            // Vérification de la hiérarchie - utilisez directement PermissionsBitField du module discord.js
            if (guild.members.me.roles.highest.position <= roleToAdd.position) {
                await channel.send({
                content: `⚠️ Erreur: Je ne peux pas attribuer ce rôle car il est positionné plus haut que mon rôle le plus élevé dans la hiérarchie.`
                });
                logWarning(`Problème de hiérarchie de rôles: Bot (${guild.members.me.roles.highest.position}) vs Rôle (${roleToAdd.position})`);
                return;
            }
            
            // Tenter d'ajouter le rôle avec gestion spécifique des erreurs
            try {
                await userMember.roles.add(roleToAdd);
                logInfo(`Rôle de validation ajouté à ${userMember.user.tag}`);
                
                await channel.send({
                content: `Le rôle <@&${guildConfig.validRequestRoleId}> a été attribué à <@${userId}>.`
                });
            } catch (roleError) {
                // Gestion détaillée de l'erreur d'ajout de rôle
                const errorDetails = `Code: ${roleError.code}, Message: ${roleError.message}`;
                logError(`Erreur précise lors de l'ajout du rôle: ${errorDetails}`);
                
                await channel.send({
                content: `⚠️ Je n'ai pas pu attribuer le rôle pour la raison suivante: ${errorDetails}`
                });
            }
            } else {
            logWarning(`Le rôle de validation n'est pas configuré pour le serveur ${interaction.guild.name}`);
            await channel.send({
                content: `⚠️ Attention : Le rôle de validation n'est pas configuré correctement. Veuillez contacter un administrateur.`
            });
            }
        } catch (error) {
            logError(`Erreur lors de l'ajout du rôle à l'utilisateur ${userId}`, error);
            await channel.send({
            content: `⚠️ Erreur lors de l'attribution du rôle à <@${userId}>. Détails: ${error.message} (Code: ${error.code || "aucun code"})`
            });
        }
      } else {
        // Si refusé, déplacer vers une catégorie des demandes refusées (à créer si nécessaire)
        let rejectedCategory = interaction.guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name === categoryRejectedName
        );
        
        if (!rejectedCategory) {
          // Lors de la création des catégories et des canaux, ajouter des permissions pour tous les rôles au-dessus de staffWlRoleId
          const staffRole = interaction.guild.roles.cache.get(guildConfig.staffWlRoleId);
          if (!staffRole) {
            await interaction.reply({
              content: "❌ Le rôle de modérateur configuré est introuvable sur ce serveur.",
              ephemeral: true
            });
            return;
          }
          
          // Récupérer tous les rôles au-dessus de staffWlRoleId
          const higherRoles = interaction.guild.roles.cache.filter(role => role.position > staffRole.position);
          
          // Ajouter les permissions pour ces rôles lors de la création des catégories et des canaux
          const permissionOverwrites = [
            {
              id: interaction.guild.id, // @everyone
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: interaction.guild.members.me.id, // Le bot
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            },
            ...higherRoles.map(role => ({
              id: role.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }))
          ];
          
          // Utiliser ces permissions lors de la création des catégories et des canaux
          rejectedCategory = await interaction.guild.channels.create({
            name: categoryRejectedName,
            type: ChannelType.GuildCategory,
            permissionOverwrites
          });
        }
        
        await channel.setParent(rejectedCategory.id, { lockPermissions: false });
        
        // Envoyer un message de suivi
        await channel.send({
          content: `<@${userId}>, désolé, votre demande de whitelist a été refusée. Vous pouvez contacter un modérateur pour en savoir plus.`
        });
      }
      
      logInfo(`Demande de whitelist ${action} pour l'utilisateur <@${userId}> par ${interaction.user.tag}`);
      
    } catch (error) {
      logError(`Erreur lors du traitement du bouton de validation/refus`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Désolé, une erreur s'est produite lors du traitement de votre action. Veuillez réessayer plus tard.",
          ephemeral: true
        });
      }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    // Vérifier si c'est un bouton de validation ou de refus d'entretien
    if (!interaction.customId.startsWith('validate_interview_') && !interaction.customId.startsWith('reject_interview_')) return;
    
    try {
      // Récupérer l'ID de l'utilisateur concerné
      const userId = interaction.customId.split('_')[2];
      
      // Récupérer la configuration du serveur
      const guildConfig = getGuildConfig(interaction.guild.id);
      if (!guildConfig) {
        await interaction.reply({
          content: "❌ Erreur: Configuration du serveur manquante. Veuillez contacter un administrateur.",
          ephemeral: true
        });
        return;
      }
      
      if (!guildConfig.staffWlRoleId) {
        await interaction.reply({
          content: "❌ La configuration du rôle modérateur est manquante sur ce serveur.",
          ephemeral: true
        });
        return;
      }
      
      // Vérifier si l'utilisateur a au moins le rôle staffWlRoleId ou un rôle supérieur
      const staffRole = interaction.guild.roles.cache.get(guildConfig.staffWlRoleId);
      if (!staffRole) {
        await interaction.reply({
          content: "❌ Le rôle de modérateur configuré est introuvable sur ce serveur.",
          ephemeral: true
        });
        return;
      }
      
      const hasRequiredRole = interaction.member.roles.cache.some(role => role.position >= staffRole.position);
      if (!hasRequiredRole) {
        await interaction.reply({
          content: "❌ Vous n'avez pas la permission d'utiliser ce bouton. Seuls les modérateurs ou utilisateurs avec un rôle supérieur peuvent valider ou refuser les demandes.",
          ephemeral: true
        });
        return;
      }
      
      const isValidation = interaction.customId.startsWith('validate_interview_');
      const action = isValidation ? "validé" : "refusé";
      const emoji = isValidation ? "✅" : "❌";
      const color = isValidation ? Colors.Green : Colors.Red;
      
      // Créer l'embed de réponse
      const responseEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} Entretien ${action}`)
        .setDescription(`L'entretien de whitelist a été ${action} par <@${interaction.user.id}>.`)
        .setFooter({ text: `Modérateur: ${interaction.user.tag}` })
        .setTimestamp();
      
      // Mettre à jour le message avec le nouvel embed et retirer les boutons
      await interaction.update({
        content: isValidation 
          ? `<@${userId}>, votre entretien de whitelist a été approuvé! 🎉 Bienvenue sur le serveur!`
          : `<@${userId}>, votre entretien de whitelist a été refusé.`,
        components: [],
        embeds: [responseEmbed]
      });
      
      // Obtenir l'objet canal et guild
      const channel = interaction.channel;
      const guild = interaction.guild;
      
      if (isValidation) {
        // Si l'entretien est validé, ajouter le rôle final de WL
        try {
          const userMember = await guild.members.fetch(userId);
          
          if (guildConfig.validWlRoleId) {
            // Récupérer le rôle à ajouter
            const roleToAdd = guild.roles.cache.get(guildConfig.validWlRoleId);
            
            // Vérifier si le rôle existe
            if (!roleToAdd) {
              await channel.send({
                content: `⚠️ Erreur: Le rôle avec l'ID ${guildConfig.validWlRoleId} n'existe pas.`
              });
              return;
            }

            const rolesToRemove = [
              guild.roles.cache.get(guildConfig.defaultRoleId),
              guild.roles.cache.get(guildConfig.validRequestRoleId)
            ];
            
            // Vérifier la hiérarchie des rôles
            if (guild.members.me.roles.highest.position <= roleToAdd.position) {
              await channel.send({
                content: `⚠️ Erreur: Je ne peux pas attribuer ce rôle car il est positionné plus haut que mon rôle le plus élevé dans la hiérarchie.`
              });
              logWarning(`Problème de hiérarchie de rôles: Bot (${guild.members.me.roles.highest.position}) vs Rôle (${roleToAdd.position})`);
              return;
            }
            
            // Vérifier la permission de gérer les rôles - utilisez PermissionsBitField, pas PermissionFlagsBits
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
              await channel.send({
                content: `⚠️ Je n'ai pas la permission de gérer les rôles. Veuillez donner la permission "Gérer les rôles" à mon rôle.`
              });
              return;
            }
            
            // Tenter d'ajouter le rôle avec gestion spécifique des erreurs
            try {
              await userMember.roles.add(roleToAdd);
              logInfo(`Rôle de WL validée ajouté à ${userMember.user.tag}`);
              rolesToRemove.forEach(role => {
                if (role) {
                  userMember.roles.remove(role)
                }
              });
              
              await channel.permissionOverwrites.edit(userMember, {
                VIEW_CHANNEL: false
              });
            } catch (roleError) {
              // Gestion détaillée de l'erreur d'ajout de rôle
              const errorDetails = `Code: ${roleError.code}, Message: ${roleError.message}`;
              logError(`Erreur précise lors de l'ajout du rôle: ${errorDetails}`);
              
              await channel.send({
                content: `⚠️ Je n'ai pas pu attribuer le rôle pour la raison suivante: ${errorDetails}`
              });
            }
          } else {
            logWarning(`Le rôle de WL finale n'est pas configuré pour le serveur ${guild.name}`);
            await channel.send({
              content: `⚠️ Attention : Le rôle de WL finale n'est pas configuré correctement. Veuillez contacter un administrateur.`
            });
          }
        } catch (error) {
          logError(`Erreur lors de l'ajout du rôle final à l'utilisateur ${userId}`, error);
          await channel.send({
            content: `⚠️ Erreur lors de l'attribution du rôle à <@${userId}>. Détails: ${error.message || "Erreur inconnue"} (Code: ${error.code || "aucun code"})`
          });
        }
        
        // Le reste de votre code pour la création de catégorie et déplacement de canal...
      
      } else {
        // Votre code pour le cas de refus...
      }
      
    } catch (error) {
      logError(`Erreur lors du traitement du bouton d'entretien`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Désolé, une erreur s'est produite lors du traitement de votre action. Veuillez réessayer plus tard.",
          ephemeral: true
        });
      }
    }
});

client.on(Events.GuildMemberAdd, async member => {
  try {
    const guildId = member.guild.id;
    
    // Vérifier si le serveur est configuré
    if (!isGuildConfigured(guildId)) {
      return;
    }
    
    // Récupérer la configuration
    const guildConfig = getGuildConfig(guildId);
    if (!guildConfig || !guildConfig.defaultRoleId) {
      return;
    }
    
    // Récupérer le rôle par défaut
    const defaultRole = member.guild.roles.cache.get(guildConfig.defaultRoleId);
    if (!defaultRole) {
      logWarning(`Le rôle par défaut configuré (${guildConfig.defaultRoleId}) n'existe pas sur le serveur ${member.guild.name}`);
      return;
    }
    
    // Ajouter le rôle au membre
    try {
      await member.roles.add(defaultRole);
      logInfo(`Rôle par défaut (${defaultRole.name}) attribué à ${member.user.tag} sur ${member.guild.name}`);
    } catch (error) {
      logError(`Erreur lors de l'attribution du rôle par défaut à ${member.user.tag}`, error);
    }
  } catch (error) {
    logError(`Erreur dans le gestionnaire d'événement GuildMemberAdd`, error);
  }
});

// Connexion du bot
client.login(token)
  .then(() => console.log('Bot connecté avec succès'))
  .catch(error => {
    logError('Erreur de connexion du bot', error);
    process.exit(1);
  });