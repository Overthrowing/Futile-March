import os
import minify_html
from bs4 import BeautifulSoup

def pack_project(base_dir, html_file, output_file):
    # 1. Setup paths
    base_dir = os.path.abspath(base_dir)
    full_html_path = os.path.join(base_dir, html_file)

    print(f"📦 Packaging: {full_html_path}")

    # 2. Load HTML
    with open(full_html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    # 3. Inline JS
    for script in soup.find_all('script', src=True):
        clean_src = script['src'].lstrip('/\\')
        src_path = os.path.join(base_dir, clean_src)

        if os.path.exists(src_path):
            print(f"  + Inlining JS: {clean_src}")
            with open(src_path, 'r', encoding='utf-8') as js_file:
                script.string = js_file.read()
                del script['src'] # Remove the src attribute

    # 4. Inline CSS
    for link in soup.find_all('link', rel='stylesheet'):
        clean_href = link['href'].lstrip('/\\')
        href_path = os.path.join(base_dir, clean_href)

        if os.path.exists(href_path):
            print(f"  + Inlining CSS: {clean_href}")
            with open(href_path, 'r', encoding='utf-8') as css_file:
                # Create new <style> tag
                new_style = soup.new_tag('style')
                new_style.string = css_file.read()
                link.replace_with(new_style)

    # 5. Minify Everything (HTML + Inline JS + Inline CSS)
    print("🔨 Minifying...")
    try:
        minified = minify_html.minify(
            str(soup),
            minify_js=True,
            minify_css=True,
            remove_processing_instructions=True
        )
    except Exception as e:
        print(f"⚠️ Minification failed (saving unminified): {e}")
        minified = str(soup)

    # 6. Save
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(minified)

    print(f"✅ Done! Saved to {output_file}")

if __name__ == "__main__":
    pack_project(
        base_dir="./sisyphus",      # Folder containing your assets
        html_file="game.html",      # Main HTML file inside that folder
        output_file="bundled/sisyphus.html"
    )