#\!/bin/bash

# Function to convert WAV to MP3
convert_to_mp3() {
    input_file="$1"
    output_file="$2"
    
    # Check if ffmpeg is available
    if command -v ffmpeg &> /dev/null; then
        ffmpeg -i "$input_file" -codec:a libmp3lame -qscale:a 2 "$output_file" -y
        echo "Converted $input_file to $output_file"
    else
        # If ffmpeg is not available, copy the WAV file as is
        cp "$input_file" "${output_file%.mp3}.wav"
        echo "Copied $input_file to ${output_file%.mp3}.wav (ffmpeg not available for conversion)"
    fi
}

# Create sound files
convert_to_mp3 "assets/FreeSFX/GameSFX/Alarms Blip Beeps/Retro Blip 07.wav" "public/assets/sounds/effects/click.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Alarms Blip Beeps/Retro Blip 15.wav" "public/assets/sounds/effects/select.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Alarms Blip Beeps/Retro Alarm 02.wav" "public/assets/sounds/effects/error.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/PowerUp/Retro PowerUP 09.wav" "public/assets/sounds/effects/success.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Vehicles/Retro Vehicle Motor 02.wav" "public/assets/sounds/effects/tankMove.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Weapon/Retro Gun SingleShot 04.wav" "public/assets/sounds/effects/tankShoot.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Explosion/Retro Explosion Short 01.wav" "public/assets/sounds/effects/explosion.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/PowerUp/Retro PowerUP 23.wav" "public/assets/sounds/effects/upgrade.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/PickUp/Retro PickUp Coin 07.wav" "public/assets/sounds/effects/giveAP.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Impact/Retro Impact Punch 07.wav" "public/assets/sounds/effects/takeDamage.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Music/Success/Retro Success Melody 01 - sawtooth lead 1.wav" "public/assets/sounds/effects/victory.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Music/Negative/Retro Negative Melody 01 - aCustom1.wav" "public/assets/sounds/effects/defeat.mp3"
convert_to_mp3 "assets/FreeSFX/GameSFX/Music/ChipWave/Retro Music - ABMU - ChipWave 01.wav" "public/assets/sounds/music/background.mp3"

echo "All sound conversions completed\!"
