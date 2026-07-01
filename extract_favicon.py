from PIL import Image

def extract_favicon():
    img = Image.open('public/smart_food_logo.png')
    
    # We assume the icon is a square on the left side
    height = img.size[1]
    
    # Crop a square from the left (x=0, y=0, width=height, height=height)
    # Adding a slight offset if there's padding, but let's try strict left first
    box = (0, 0, height, height)
    icon = img.crop(box)
    
    # Save as PNG
    icon.save('public/favicon.png')
    
    # Also save as ICO
    # ICO expects multiple sizes or a single size, let's just resize to 64x64 for ICO
    icon_ico = icon.resize((64, 64), Image.Resampling.LANCZOS)
    icon_ico.save('public/favicon.ico')
    
    print("Favicon extracted successfully!")

if __name__ == '__main__':
    extract_favicon()
