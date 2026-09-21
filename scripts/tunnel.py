"""
WARRANT Zero-Trust Tunnel Daemon
Spawns Cloudflare Tunnel to expose local FastAPI backend (port 8000) over public HTTPS.
Requires zero accounts, zero authentication keys, and zero port-forwarding.
"""

import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CLOUDFLARED_BIN = PROJECT_ROOT / "scripts" / "cloudflared"
URL_LOG_FILE = PROJECT_ROOT / "data" / "live_tunnel_url.txt"
PORT = 8000


def run_tunnel():
    if not CLOUDFLARED_BIN.exists():
        print(f"Fetching cloudflared static binary to {CLOUDFLARED_BIN}...")
        CLOUDFLARED_BIN.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "curl",
                "-sL",
                "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
                "-o",
                str(CLOUDFLARED_BIN),
            ],
            check=True,
        )
        CLOUDFLARED_BIN.chmod(0o755)
        print("cloudflared binary installed successfully.")


    print("-" * 70)
    print("           WARRANT ZERO-TRUST CLOUDFLARE TUNNEL DAEMON           ")
    print(f" Target: http://localhost:{PORT} (Local RTX 4060 GPU / FastAPI Backend)")
    print("-" * 70)

    cmd = [
        str(CLOUDFLARED_BIN),
        "tunnel",
        "--url",
        f"http://localhost:{PORT}",
        "--no-autoupdate",
    ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    tunnel_url = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    def handle_exit(signum, frame):
        print("\nTerminating Cloudflare Tunnel daemon...")
        process.terminate()
        if URL_LOG_FILE.exists():
            URL_LOG_FILE.unlink(missing_ok=True)
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    print("Negotiating zero-trust edge connection with Cloudflare global network...")

    for line in iter(process.stdout.readline, ""):
        match = url_pattern.search(line)
        if match and not tunnel_url:
            tunnel_url = match.group(0)
            URL_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(URL_LOG_FILE, "w", encoding="utf-8") as f:
                f.write(tunnel_url.strip() + "\n")

            print("\n" + "=" * 70)
            print(f" [SUCCESS] LIVE PUBLIC HTTPS TUNNEL ESTABLISHED:")
            print(f" URL: {tunnel_url}")
            print("=" * 70)
            print("\nYou can now open your Vercel frontend and connect to this URL:")
            print(f"  Vercel -> Click 'Live GPU' -> Paste: {tunnel_url}")
            print("\nPress Ctrl+C to stop the tunnel.\n")

    process.wait()


if __name__ == "__main__":
    run_tunnel()
