#!/usr/bin/env python3
"""
Script de déploiement automatique du bot Discord lost-bot
Vers le serveur distant configuré dans .env
"""

import os
import sys
import stat
import time
import paramiko
from pathlib import Path, PurePosixPath
from dotenv import load_dotenv

# ─── Chargement du .env ─────────────────────────────────────────────────────
LOCAL_PROJECT_DIR = Path(__file__).parent.resolve()
load_dotenv(LOCAL_PROJECT_DIR / ".env")

# ─── Configuration (depuis .env, catégorie DEPLOY_) ─────────────────────────
SSH_HOST = os.environ["DEPLOY_SSH_HOST"]
SSH_PORT = int(os.environ.get("DEPLOY_SSH_PORT", "22"))
SSH_USER = os.environ["DEPLOY_SSH_USER"]
SSH_PASSWORD = os.environ["DEPLOY_SSH_PASSWORD"]
REMOTE_DIR = os.environ["DEPLOY_REMOTE_DIR"]
SERVICE_NAME = os.environ.get("DEPLOY_SERVICE_NAME", "lost-bot")

# Fichiers/dossiers à exclure de l'upload
EXCLUDE = {
    "node_modules",
    ".git",
    "__pycache__",
    "deploy.py",
    ".gitignore",
    ".env",
    ".env.dev",
    ".env.example",
}

# ─── Service systemd ────────────────────────────────────────────────────────
SYSTEMD_UNIT = f"""[Unit]
Description=Lost Bot Discord - Bot de gestion de présence
After=network.target

[Service]
Type=simple
User={SSH_USER}
WorkingDirectory={REMOTE_DIR}
ExecStart=/usr/bin/node {REMOTE_DIR}/src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile={REMOTE_DIR}/.env
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
"""


def log(msg: str, level: str = "INFO"):
    colors = {
        "INFO": "\033[94m",
        "OK": "\033[92m",
        "WARN": "\033[93m",
        "ERR": "\033[91m",
        "STEP": "\033[96m",
    }
    reset = "\033[0m"
    color = colors.get(level, "")
    print(f"{color}[{level}]{reset} {msg}")


def run_cmd(ssh: paramiko.SSHClient, cmd: str, sudo: bool = False, check: bool = True) -> str:
    """Exécute une commande SSH et retourne stdout.
    Si sudo=True, envoie le mot de passe via stdin pour éviter le blocage.
    """
    full_cmd = f"sudo -S {cmd}" if sudo else cmd
    log(f"  $ {full_cmd}", "INFO")
    stdin, stdout, stderr = ssh.exec_command(full_cmd, timeout=120)

    if sudo:
        stdin.write(SSH_PASSWORD + "\n")
        stdin.flush()

    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()

    # Filtrer le prompt "[sudo] password" du stderr
    err_lines = [l for l in err.split("\n") if not l.startswith("[sudo]")]
    err = "\n".join(err_lines).strip()

    if out:
        for line in out.split("\n"):
            print(f"    {line}")
    if err:
        for line in err.split("\n"):
            print(f"    (stderr) {line}")
    if check and exit_code != 0:
        log(f"Commande échouée (code {exit_code}): {full_cmd}", "ERR")
        raise RuntimeError(f"Commande échouée: {full_cmd}")
    return out


def sftp_mkdir_p(sftp: paramiko.SFTPClient, remote_path: str):
    """Crée un répertoire distant récursivement (comme mkdir -p)."""
    parts = PurePosixPath(remote_path).parts
    current = ""
    for part in parts:
        current = current + "/" + part if current else part
        if not current.startswith("/"):
            current = "/" + current
        try:
            sftp.stat(current)
        except FileNotFoundError:
            log(f"  Création dossier: {current}", "INFO")
            sftp.mkdir(current)


def upload_env(sftp: paramiko.SFTPClient, remote_path: str):
    """Upload un .env filtré (sans les variables DEPLOY_*) sur le serveur."""
    env_path = LOCAL_PROJECT_DIR / ".env"
    remote_env = f"{remote_path}/.env"

    lines = env_path.read_text(encoding="utf-8").splitlines()
    filtered = [l for l in lines if not l.startswith("DEPLOY_") and "# ─── Deploy" not in l]

    # Supprimer les lignes vides en fin de fichier
    while filtered and filtered[-1].strip() == "":
        filtered.pop()

    content = "\n".join(filtered) + "\n"

    log(f"  Upload: .env (filtré, sans DEPLOY_*)", "INFO")
    with sftp.open(remote_env, "w") as f:
        f.write(content)


def upload_directory(sftp: paramiko.SFTPClient, local_path: Path, remote_path: str):
    """Upload récursif d'un dossier local vers le serveur distant."""
    sftp_mkdir_p(sftp, remote_path)

    for item in sorted(local_path.iterdir()):
        if item.name in EXCLUDE:
            log(f"  Skip: {item.name}", "WARN")
            continue

        if item.is_file() and item.suffix == ".json":
            log(f"  Skip: {item.name} (json)", "WARN")
            continue

        remote_item = f"{remote_path}/{item.name}"

        if item.is_dir():
            upload_directory(sftp, item, remote_item)
        elif item.is_file():
            size_kb = item.stat().st_size / 1024
            log(f"  Upload: {item.relative_to(LOCAL_PROJECT_DIR)} ({size_kb:.1f} KB)", "INFO")
            sftp.put(str(item), remote_item)


def main():
    log("=" * 60, "STEP")
    log("  DÉPLOIEMENT LOST-BOT DISCORD", "STEP")
    log("=" * 60, "STEP")
    log(f"Serveur cible : {SSH_USER}@{SSH_HOST}", "INFO")
    log(f"Dossier distant : {REMOTE_DIR}", "INFO")
    log(f"Projet local   : {LOCAL_PROJECT_DIR}", "INFO")
    print()

    # ── Étape 1 : Connexion SSH ──────────────────────────────────────────
    log("ÉTAPE 1 : Connexion SSH...", "STEP")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD, timeout=15)
    except Exception as e:
        log(f"Impossible de se connecter: {e}", "ERR")
        sys.exit(1)

    log("Connecté avec succès!", "OK")
    print()

    # ── Étape 2 : Vérifier que Node.js est installé ─────────────────────
    log("ÉTAPE 2 : Vérification de Node.js...", "STEP")
    try:
        node_version = run_cmd(ssh, "node --version")
        log(f"Node.js trouvé: {node_version}", "OK")
    except RuntimeError:
        log("Node.js non trouvé. Installation via NodeSource...", "WARN")
        run_cmd(ssh, "bash -c 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash -'", sudo=True, check=False)
        run_cmd(ssh, "apt-get install -y nodejs", sudo=True)
        node_version = run_cmd(ssh, "node --version")
        log(f"Node.js installé: {node_version}", "OK")

    npm_version = run_cmd(ssh, "npm --version", check=False)
    log(f"npm: {npm_version}", "OK")
    print()

    # ── Étape 3 : Préparer le dossier distant ───────────────────────────
    log("ÉTAPE 3 : Préparation du dossier distant...", "STEP")
    run_cmd(ssh, f"mkdir -p {REMOTE_DIR}/images")
    log("Dossiers créés.", "OK")
    print()

    # ── Étape 4 : Arrêter le service si actif ────────────────────────────
    log("ÉTAPE 4 : Arrêt du service (si actif)...", "STEP")
    run_cmd(ssh, f"systemctl stop {SERVICE_NAME} 2>/dev/null || true", sudo=True, check=False)
    log("Service arrêté (ou n'était pas lancé).", "OK")
    print()

    # ── Étape 5 : Upload des fichiers ────────────────────────────────────
    log("ÉTAPE 5 : Upload des fichiers du projet...", "STEP")
    sftp = ssh.open_sftp()

    upload_directory(sftp, LOCAL_PROJECT_DIR, REMOTE_DIR)

    # Upload du .env filtré (sans les credentials de deploy)
    upload_env(sftp, REMOTE_DIR)

    sftp.close()
    log("Tous les fichiers ont été uploadés!", "OK")
    print()

    # ── Étape 6 : Installation des dépendances npm ──────────────────────
    log("ÉTAPE 6 : Installation des dépendances (npm install)...", "STEP")
    run_cmd(ssh, f"cd {REMOTE_DIR} && npm install --production", check=True)
    log("Dépendances installées!", "OK")
    print()

    # ── Étape 7 : Permissions sur les fichiers ───────────────────────────
    log("ÉTAPE 7 : Configuration des permissions...", "STEP")
    run_cmd(ssh, f"chmod -R 755 {REMOTE_DIR}")
    run_cmd(ssh, f"chmod 644 {REMOTE_DIR}/images/* 2>/dev/null || true", check=False)
    log("Permissions configurées.", "OK")
    print()

    # ── Étape 8 : Création du service systemd ────────────────────────────
    log("ÉTAPE 8 : Configuration du service systemd...", "STEP")

    service_path = f"/etc/systemd/system/{SERVICE_NAME}.service"
    tmp_service = f"/tmp/{SERVICE_NAME}.service"

    # Upload du fichier service via SFTP puis déplacement avec sudo
    sftp = ssh.open_sftp()
    with sftp.open(tmp_service, "w") as f:
        f.write(SYSTEMD_UNIT)
    sftp.close()
    log(f"  Upload: {SERVICE_NAME}.service -> /tmp/", "INFO")

    run_cmd(ssh, f"mv {tmp_service} {service_path}", sudo=True)
    log(f"Fichier service créé: {service_path}", "OK")

    # Recharger systemd et activer le service
    run_cmd(ssh, "systemctl daemon-reload", sudo=True)
    run_cmd(ssh, f"systemctl enable {SERVICE_NAME}", sudo=True)
    log("Service activé au démarrage.", "OK")
    print()

    # ── Étape 9 : Démarrage du service ───────────────────────────────────
    log("ÉTAPE 9 : Démarrage du service...", "STEP")
    run_cmd(ssh, f"systemctl start {SERVICE_NAME}", sudo=True)
    time.sleep(2)

    # Vérification du statut
    status = run_cmd(ssh, f"systemctl is-active {SERVICE_NAME}", check=False)
    if status == "active":
        log("Le service est ACTIF et fonctionne!", "OK")
    else:
        log(f"Statut du service: {status}", "WARN")
        log("Vérification des logs...", "WARN")
        run_cmd(ssh, f"journalctl -u {SERVICE_NAME} -n 20 --no-pager", check=False)

    print()

    # ── Étape 10 : Résumé final ──────────────────────────────────────────
    log("=" * 60, "STEP")
    log("  DÉPLOIEMENT TERMINÉ!", "OK")
    log("=" * 60, "STEP")
    print()
    log(f"Bot déployé sur    : {SSH_USER}@{SSH_HOST}:{REMOTE_DIR}", "INFO")
    log(f"Service systemd    : {SERVICE_NAME}", "INFO")
    log(f"Commandes utiles   :", "INFO")
    print(f"  - Statut  : sudo systemctl status {SERVICE_NAME}")
    print(f"  - Logs    : sudo journalctl -u {SERVICE_NAME} -f")
    print(f"  - Restart : sudo systemctl restart {SERVICE_NAME}")
    print(f"  - Stop    : sudo systemctl stop {SERVICE_NAME}")
    print()

    ssh.close()
    log("Connexion SSH fermée. Terminé!", "OK")


if __name__ == "__main__":
    main()
