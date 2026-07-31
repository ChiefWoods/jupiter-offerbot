import {
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  Client,
  Events,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import type { SubscriptionApi } from "@jupiter-offerbot/channel";
import { createCommandHandlers } from "./commands";

const slashCommands = [
  new SlashCommandBuilder().setName("offerbot").setDescription("Introduce Offerbot"),
  new SlashCommandBuilder().setName("list").setDescription("List your watched mints"),
  new SlashCommandBuilder()
    .setName("watch")
    .setDescription("Watch a mint at an optional APY ceiling")
    .addStringOption((option) =>
      option.setName("mint").setDescription("Solana mint").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("max_apy").setDescription("Maximum APY, e.g. 7.25"),
    ),
  new SlashCommandBuilder()
    .setName("update")
    .setDescription("Update a watched mint's APY ceiling")
    .addStringOption((option) =>
      option.setName("mint").setDescription("Solana mint").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("max_apy").setDescription("Maximum APY, e.g. 7.25"),
    ),
  new SlashCommandBuilder()
    .setName("unwatch")
    .setDescription("Stop watching a mint")
    .addStringOption((option) =>
      option.setName("mint").setDescription("Solana mint").setRequired(true),
    ),
].map((command) =>
  command
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ),
);

export function createBot(subscriptions: SubscriptionApi) {
  const bot = new Client({ intents: [] });
  const commands = createCommandHandlers(subscriptions);

  bot.once(Events.ClientReady, async (client) => {
    await client.application.commands.set(slashCommands.map((command) => command.toJSON()));
  });
  bot.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await handleCommand(commands, interaction);
  });
  return bot;
}

async function handleCommand(
  commands: ReturnType<typeof createCommandHandlers>,
  interaction: ChatInputCommandInteraction,
) {
  switch (interaction.commandName) {
    case "offerbot":
      await commands.offerbot(interaction);
      break;
    case "list":
      await commands.list(interaction);
      break;
    case "watch":
      await commands.watch(
        interaction,
        interaction.options.getString("mint", true),
        interaction.options.getString("max_apy"),
      );
      break;
    case "update":
      await commands.update(
        interaction,
        interaction.options.getString("mint", true),
        interaction.options.getString("max_apy"),
      );
      break;
    case "unwatch":
      await commands.unwatch(interaction, interaction.options.getString("mint", true));
      break;
  }
}
