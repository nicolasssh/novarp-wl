const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

// Fonction pour créer un embed
function createEmbed(options = {}) {
  const { title, description, color, fields, footer, timestamp } = options;
  
  const embed = new EmbedBuilder();
  
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color) embed.setColor(color);
  if (fields && Array.isArray(fields)) embed.addFields(...fields);
  if (footer) embed.setFooter(footer);
  if (timestamp) embed.setTimestamp();
  
  return embed;
}

// Fonction pour créer un bouton
function createButton(options = {}) {
  const { customId, label, style = ButtonStyle.Primary, emoji, disabled = false } = options;
  
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label);
    
  if (style) button.setStyle(style);
  if (emoji) button.setEmoji(emoji);
  if (disabled) button.setDisabled(true);
  
  return button;
}

// Fonction pour créer une rangée de boutons
function createButtonRow(buttons = []) {
  return new ActionRowBuilder().addComponents(...buttons);
}

module.exports = {
  createEmbed,
  createButton,
  createButtonRow
};