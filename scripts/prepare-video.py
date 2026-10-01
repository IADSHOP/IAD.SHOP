import sys, subprocess
from pathlib import Path
sys.path.insert(0,str(Path('.tools/python-packages').resolve()))
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
for season,name in [('summer','SUMMER(上方).mp4'),('winter','WINTE(下方).mp4')]:
    source=Path('首頁影片')/name
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss','0.2','-i',str(source),'-frames:v','1','-vf','scale=720:-2','-q:v','3',str(source.parent/(season+'-poster.jpg'))],check=True)
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(source),'-an','-vf','scale=720:-2','-r','24','-c:v','libx264','-crf','25','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(source.parent/(season+'-web.mp4'))],check=True)
    print(season,'web video:',(source.parent/(season+'-web.mp4')).stat().st_size,flush=True)
