import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const pluginRoot = resolve(
  process.cwd(),
  "node_modules/@dwbn/capacitor-plugin-playlist/android/src/main/java/org/dwbn/plugins/playlist",
);

async function replaceExactlyOnce(relativePath, oldText, newText, label) {
  const filePath = resolve(pluginRoot, relativePath);
  const source = await readFile(filePath, "utf8");
  const occurrences = source.split(oldText).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected one patch point for ${label}; found ${occurrences} in ${relativePath}`);
  }
  await writeFile(filePath, source.replace(oldText, newText), "utf8");
  console.log(`Patched ${label}`);
}

await replaceExactlyOnce(
  "service/MediaService.kt",
  "        val player = playerBuilder\n            .setAudioAttributes(",
  "        val player = playerBuilder\n            .setSeekBackIncrementMs(5_000L)\n            .setSeekForwardIncrementMs(5_000L)\n            .setAudioAttributes(",
  "5-second player seek increments",
);

await replaceExactlyOnce(
  "service/MediaNotificationPolicy.kt",
  "        val builder = base.buildUpon().add(Player.COMMAND_PLAY_PAUSE)",
  "        val builder = base.buildUpon()\n            .add(Player.COMMAND_PLAY_PAUSE)\n            .add(Player.COMMAND_SEEK_BACK)\n            .add(Player.COMMAND_SEEK_FORWARD)",
  "notification seek commands",
);

await replaceExactlyOnce(
  "service/PlaylistMediaSessionCallback.kt",
  "import androidx.annotation.OptIn\nimport androidx.media3.common.util.UnstableApi",
  "import androidx.annotation.OptIn\nimport androidx.media3.common.Player\nimport androidx.media3.common.util.UnstableApi\nimport androidx.media3.session.CommandButton",
  "notification control imports",
);

await replaceExactlyOnce(
  "service/PlaylistMediaSessionCallback.kt",
  ") : MediaSession.Callback {\n\n    override fun onConnect(",
  `) : MediaSession.Callback {

    private val seekBackFiveButton = CommandButton.Builder(CommandButton.ICON_SKIP_BACK_5)
        .setDisplayName("الرجوع ٥ ثوانٍ")
        .setPlayerCommand(Player.COMMAND_SEEK_BACK)
        .setSlots(intArrayOf(CommandButton.SLOT_OVERFLOW))
        .build()

    private val seekForwardFiveButton = CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD_5)
        .setDisplayName("التقديم ٥ ثوانٍ")
        .setPlayerCommand(Player.COMMAND_SEEK_FORWARD)
        .setSlots(intArrayOf(CommandButton.SLOT_OVERFLOW))
        .build()

    override fun onConnect(`,
  "5-second notification buttons",
);

await replaceExactlyOnce(
  "service/PlaylistMediaSessionCallback.kt",
  `                .setAvailablePlayerCommands(
                    MediaNotificationPolicy.playerCommandsForMediaNotification(
                        MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS,
                        availability.previousAvailable,
                        availability.nextAvailable
                    )
                )
                .build()`,
  `                .setAvailablePlayerCommands(
                    MediaNotificationPolicy.playerCommandsForMediaNotification(
                        MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS,
                        availability.previousAvailable,
                        availability.nextAvailable
                    )
                )
                .setMediaButtonPreferences(listOf(seekBackFiveButton, seekForwardFiveButton))
                .build()`,
  "notification button layout",
);
