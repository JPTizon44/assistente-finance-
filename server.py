import http.server
import socketserver
import socket
import os
import qrcode
import sys
import io

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def start_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = 5500
    local_ip = get_local_ip()
    url = f"http://{local_ip}:{port}"

    print("=" * 60)
    print("   DHG TIZON - SERVIDOR MOVEL & SINCRONIZACAO EM NUVEM")
    print("=" * 60)
    print("\n[+] Aponte a camera do seu celular para o QR Code abaixo:")
    print("-" * 60)

    # Gera QR Code em buffer UTF-8 para evitar UnicodeEncodeError no Windows (cp1252)
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    buf = io.StringIO()
    qr.print_ascii(out=buf, invert=True)
    qr_str = buf.getvalue()
    # Imprime caractere a caractere, substituindo blocos Unicode por '#' se necessário
    safe_qr = qr_str.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8', errors='replace')
    print(safe_qr)

    print("-" * 60)
    print(f"[>] Link direto para o celular: {url}")
    print(f"[>] Link para este computador:  http://localhost:{port}")
    print("=" * 60)
    print("\n* Pressione Ctrl+C para encerrar o servidor a qualquer momento.\n")

    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado com sucesso.")

if __name__ == "__main__":
    start_server()
