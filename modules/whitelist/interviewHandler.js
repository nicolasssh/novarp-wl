const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');

// Valider ou rejeter une demande de whitelist
async function validateWhitelistRequest(client, interaction, userId, isValidation) {
  try {
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
    
    // Vérifier si l'utilisateur a le rôle requis
    const member = interaction.member;
    if (!member.roles.cache.has(guildConfig.staffWlRoleId)) {
      await interaction.reply({
        content: "❌ Vous n'avez pas la permission d'utiliser ce bouton. Seuls les modérateurs peuvent valider ou refuser les demandes.",
        ephemeral: true
      });
      return;
    }
    
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
    
    // Mettre à jour le message avec le nouvel embed
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
    const guild = interaction.guild;
    
    // Récupérer les noms des catégories depuis la configuration
    const categoryApprovedName = guildConfig.categories?.approved || '✅ WL validée';
    const categoryRejectedName = guildConfig.categories?.rejected || '❌ WL refusée';
    
    if (isValidation) {
      await processValidation(guild, channel, userId, guildConfig, categoryApprovedName);
    } else {
      await processRejection(guild, channel, userId, categoryRejectedName);
    }
    
    logger.info(`Demande de whitelist ${action} pour l'utilisateur <@${userId}> par ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Erreur lors du traitement du bouton de validation/refus`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Désolé, une erreur s'est produite lors du traitement de votre action. Veuillez réessayer plus tard.",
        ephemeral: true
      });
    }
  }
}

// Traiter une validation de formulaire
async function processValidation(guild, channel, userId, guildConfig, categoryApprovedName) {
  try {
    // Si validé, déplacer vers la catégorie des demandes validées (à créer si nécessaire)
    let validatedCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === categoryApprovedName
    );
    
    if (!validatedCategory) {
      validatedCategory = await guild.channels.create({
        name: categoryApprovedName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
    }
    
    await channel.setParent(validatedCategory.id, { lockPermissions: false });
    
    // Envoyer un message de suivi
    await channel.send({
      content: `<@${userId}>, félicitations! Votre formulaire de whitelist a été validé. Un modérateur va maintenant procéder à l'entretien.`
    });
    
    // Trouver le membre et lui ajouter le rôle
    try {
      const userMember = await guild.members.fetch(userId);
      
      if (guildConfig.validRequestRoleId) {
        // Vérifier si le bot a la permission et si le rôle est accessible
        const botMember = guild.members.me;
        const roleToAdd = guild.roles.cache.get(guildConfig.validRequestRoleId);
        
        // Vérifier si le rôle existe
        if (!roleToAdd) {
          await channel.send({
            content: `⚠️ Erreur: Le rôle avec l'ID ${guildConfig.validRequestRoleId} n'existe pas.`
          });
          return;
        }
        
        // Vérifier la hiérarchie des rôles
        if (roleToAdd.position >= botMember.roles.highest.position) {
          await channel.send({
            content: `⚠️ Je ne peux pas attribuer le rôle ${roleToAdd.name} car il est placé plus haut ou au même niveau que mon rôle le plus élevé dans la hiérarchie du serveur.`
          });
          logger.warning(`Problème de hiérarchie des rôles: Bot (${botMember.roles.highest.position}) vs Rôle (${roleToAdd.position})`);
          return;
        }
        
        // Vérifier la permission de gérer les rôles
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          await channel.send({
            content: `⚠️ Je n'ai pas la permission de gérer les rôles. Veuillez donner la permission "Gérer les rôles" à mon rôle.`
          });
          return;
        }
        
        // Ajouter le rôle
        await userMember.roles.add(roleToAdd);
        logger.info(`Rôle de validation ajouté à ${userMember.user.tag}`);
        
        await channel.send({
          content: `Le rôle <@&${guildConfig.validRequestRoleId}> a été attribué à <@${userId}>.`
        });
      } else {
        logger.warning(`Le rôle de validation n'est pas configuré pour le serveur ${guild.name}`);
        await channel.send({
          content: `⚠️ Attention : Le rôle de validation n'est pas configuré correctement. Veuillez contacter un administrateur.`
        });
      }
    } catch (error) {
      logger.error(`Erreur lors de l'ajout du rôle à l'utilisateur ${userId}`, error);
      await channel.send({
        content: `⚠️ Erreur lors de l'attribution du rôle à <@${userId}>. Détails: ${error.message || "Erreur inconnue"} (Code: ${error.code || "aucun code"}). Veuillez vérifier que le rôle existe et que le bot a les permissions nécessaires.`
      });
    }
  } catch (error) {
    logger.error(`Erreur lors du traitement de la validation`, error);
    throw error;
  }
}

// Traiter un refus de formulaire
async function processRejection(guild, channel, userId, categoryRejectedName) {
  try {
    // Si refusé, déplacer vers une catégorie des demandes refusées (à créer si nécessaire)
    let rejectedCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === categoryRejectedName
    );
    
    if (!rejectedCategory) {
      rejectedCategory = await guild.channels.create({
        name: categoryRejectedName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
    }
    
    await channel.setParent(rejectedCategory.id, { lockPermissions: false });
    
    // Envoyer un message de suivi
    await channel.send({
      content: `<@${userId}>, désolé, votre demande de whitelist a été refusée. Vous pouvez contacter un modérateur pour en savoir plus.`
    });
  } catch (error) {
    logger.error(`Erreur lors du traitement du refus`, error);
    throw error;
  }
}

// Valider ou rejeter un entretien
async function validateInterview(client, interaction, userId, isValidation) {
  try {
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
    
    // Vérifier si l'utilisateur a le rôle requis
    const member = interaction.member;
    if (!member.roles.cache.has(guildConfig.staffWlRoleId)) {
      await interaction.reply({
        content: "❌ Vous n'avez pas la permission d'utiliser ce bouton. Seuls les modérateurs peuvent valider ou refuser les entretiens.",
        ephemeral: true
      });
      return;
    }
    
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
    
    // Obtenir l'objet canal
    const channel = interaction.channel;
    const guild = interaction.guild;
    
    if (isValidation) {
      await processInterviewApproval(guild, channel, userId, guildConfig);
    } else {
      await processInterviewRejection(guild, channel, userId, guildConfig);
    }
    
    logger.info(`Entretien de whitelist ${action} pour l'utilisateur <@${userId}> par ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Erreur lors du traitement du bouton d'entretien`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Désolé, une erreur s'est produite lors du traitement de votre action. Veuillez réessayer plus tard.",
        ephemeral: true
      });
    }
  }
}

// Traiter l'approbation d'un entretien
async function processInterviewApproval(guild, channel, userId, guildConfig) {
  try {
    // Si l'entretien est validé, ajouter le rôle final de WL
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
      
      // Vérifier la hiérarchie des rôles
      if (guild.members.me.roles.highest.position <= roleToAdd.position) {
        await channel.send({
          content: `⚠️ Erreur: Je ne peux pas attribuer ce rôle car il est positionné plus haut que mon rôle le plus élevé dans la hiérarchie.`
        });
        logger.warning(`Problème de hiérarchie de rôles: Bot (${guild.members.me.roles.highest.position}) vs Rôle (${roleToAdd.position})`);
        return;
      }
      
      // Vérifier la permission de gérer les rôles
      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        await channel.send({
          content: `⚠️ Je n'ai pas la permission de gérer les rôles. Veuillez donner la permission "Gérer les rôles" à mon rôle.`
        });
        return;
      }
      
      // Tenter d'ajouter le rôle
      try {
        await userMember.roles.add(roleToAdd);
        logger.info(`Rôle de WL validée ajouté à ${userMember.user.tag}`);
        
        await channel.send({
          content: `🎉 Félicitations <@${userId}>! Le rôle <@&${guildConfig.validWlRoleId}> vous a été attribué, vous êtes maintenant whitelisté sur le serveur.`
        });
      } catch (roleError) {
        // Gestion détaillée de l'erreur d'ajout de rôle
        const errorDetails = `Code: ${roleError.code}, Message: ${roleError.message}`;
        logger.error(`Erreur précise lors de l'ajout du rôle: ${errorDetails}`);
        
        await channel.send({
          content: `⚠️ Je n'ai pas pu attribuer le rôle pour la raison suivante: ${errorDetails}`
        });
      }
    } else {
      logger.warning(`Le rôle de WL finale n'est pas configuré pour le serveur ${guild.name}`);
      await channel.send({
        content: `⚠️ Attention : Le rôle de WL finale n'est pas configuré correctement. Veuillez contacter un administrateur.`
      });
    }
    
    // Créer une nouvelle catégorie pour les WL complètes si elle n'existe pas
    let completedCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === '🌟 WL Complète'
    );
    
    if (!completedCategory) {
      completedCategory = await guild.channels.create({
        name: '🌟 WL Complète',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
    }
    
    // Déplacer le canal dans la catégorie
    await channel.setParent(completedCategory.id, { lockPermissions: false });
  } catch (error) {
    logger.error(`Erreur lors du traitement de l'approbation d'entretien`, error);
    throw error;
  }
}

// Traiter le refus d'un entretien
async function processInterviewRejection(guild, channel, userId, guildConfig) {
  try {
    // Si l'entretien est refusé
    await channel.send({
      content: `<@${userId}>, désolé, votre entretien de whitelist a été refusé. Vous pouvez contacter un modérateur pour en savoir plus.`
    });
    
    // Utiliser la même catégorie que les refus de formulaire
    const categoryRejectedName = guildConfig.categories?.rejected || '❌ WL refusée';
    
    let rejectedCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === categoryRejectedName
    );
    
    if (!rejectedCategory) {
      rejectedCategory = await guild.channels.create({
        name: categoryRejectedName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
    }
    
    // Déplacer le canal dans la catégorie
    await channel.setParent(rejectedCategory.id, { lockPermissions: false });
  } catch (error) {
    logger.error(`Erreur lors du traitement du refus d'entretien`, error);
    throw error;
  }
}

module.exports = {
  validateWhitelistRequest,
  validateInterview
};