import os
import re
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

def download_images(project_path):
    print(f"Analyzing README in: {project_path}")
    readme_path = Path(project_path) / "README.md"
    if not readme_path.exists():
        print(f"README.md not found in {project_path}")
        return

    try:
        content = readme_path.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        print(f"Error reading README: {e}")
        return
    
    # Regex for markdown images: ![alt](url)
    md_images = re.findall(r'!\[.*?\]\((.*?)\)', content)
    # Regex for HTML images: <img ... src="url" ...>
    html_images = re.findall(r'<img[^>]+src=["\'](.*?)["\']', content)
    
    all_urls = md_images + html_images
    
    # Filter badges/icons
    badge_domains = ['img.shields.io', 'travis-ci.org', 'github.com/workflows', 'badgen.net', 'api.star-history.com', 'trendshift.io']
    
    valid_urls = []
    for url in all_urls:
        if any(b in url for b in badge_domains):
            continue
        if url.endswith('.svg'):
            continue
        valid_urls.append(url)

    output_dir = Path(project_path) / "xianyu_materials" / "project_images"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Found {len(all_urls)} images, {len(valid_urls)} valid candidates.")
    
    count = 0
    for i, url in enumerate(valid_urls):
        try:
            target_url = url
            if not target_url.startswith('http'):
                print(f"Skipping non-http URL: {target_url}")
                continue
                
            print(f"Downloading {target_url}...")
            
            # Retry logic
            max_retries = 3
            success = False
            for attempt in range(max_retries):
                try:
                    req = urllib.request.Request(
                        target_url, 
                        data=None, 
                        headers={
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    )
                    
                    with urllib.request.urlopen(req, timeout=60) as response:
                        if response.status != 200:
                            print(f"Failed to download {target_url}: HTTP {response.status}")
                            break # Don't retry client errors if we assume user agent is fine
                            
                        data = response.read()
                        
                        # Guess extension
                        ext = os.path.splitext(target_url)[1].split('?')[0]
                        if not ext:
                            content_type = response.headers.get('Content-Type', '')
                            if 'image/png' in content_type:
                                ext = '.png'
                            elif 'image/jpeg' in content_type:
                                ext = '.jpg'
                            else:
                                ext = '.png'
                                
                        filename = f"demo_{count+1:02d}{ext}"
                        file_path = output_dir / filename
                        file_path.write_bytes(data)
                        print(f"Saved: {file_path}")
                        success = True
                        break # Success, exit retry loop
                        
                except Exception as attempt_err:
                    print(f"Attempt {attempt+1}/{max_retries} failed for {target_url}: {attempt_err}")
                    time.sleep(2) # Wait before retry
            
            if success:
                count += 1
            else:
                 print(f"Permanently failed to download: {target_url}")

        except Exception as e:
            print(f"Error processing {url}: {e}")
            
    print(f"Download complete. {count}/{len(valid_urls)} images saved to {output_dir}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_images.py <project_path>")
        sys.exit(1)
    
    download_images(sys.argv[1])
