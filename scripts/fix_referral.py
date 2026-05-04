content = open('src/app/api/telegram/webhook/route.ts').read()

start_marker = '  if (referrerUsername) {\n    // Personalised referral welcome'
end_marker = '  } else {\n    // No valid referral code or self-referral — show normal welcome'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f'ERROR: markers not found. start={start_idx}, end={end_idx}')
    exit(1)

new_block = '''  if (referrerUsername) {
    // Personalised referral welcome — use the new user's language
    const miniappUrl = env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp";
    const escapedUsername = referrerUsername.replace(/[_*[\\]()~`>#+\\-=|{}.!]/g, "\\\\$&");
    await ctx.reply(
      t('bot.referral.welcome', ctx.locale, { username: escapedUsername }),
      {
        parse_mode: "MarkdownV2",
        reply_markup: new InlineKeyboard().webApp(t('bot.miniapp.button', ctx.locale), miniappUrl),
      }
    );
'''

new_content = content[:start_idx] + new_block + content[end_idx:]
open('src/app/api/telegram/webhook/route.ts', 'w').write(new_content)
print('Done!')
