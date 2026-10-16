from PIL import Image
import os

images = [
    '/home/anonymus/Documents/olasdelsur_website/assets/promo_hero_drone_view_1774801703561.png',
    '/home/anonymus/Documents/olasdelsur_website/assets/promo_luxury_sherry_tasting_1774801732154.png',
    '/home/anonymus/Documents/olasdelsur_website/assets/promo_andalusian_street_scene_1774801745864.png',
    '/home/anonymus/Documents/olasdelsur_website/assets/promo_lifestyle_sailing_bay_1774802168665.png'
]

output_path = '/home/anonymus/Documents/olasdelsur_website/assets/promo_video.gif'

frames = []
for img_path in images:
    if os.path.exists(img_path):
        img = Image.open(img_path)
        # Resize to a common size for consistent GIF
        img = img.resize((1024, 1024), Image.Resampling.LANCZOS)
        frames.append(img)

if frames:
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=4000,  # 4 seconds per frame
        loop=0
    )
    print(f"GIF saved successfully to {output_path}")
else:
    print("No images found to create GIF.")
