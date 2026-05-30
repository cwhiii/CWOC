#!/bin/bash
# Setup local FTP server on Fedora with a dedicated ftpuser
# Run with: sudo bash setup-ftp.sh

set -e

FTP_USER="ftpuser"
MAIN_USER="cwhiii"

echo "=== Installing vsftpd ==="
dnf install -y vsftpd

echo "=== Creating dedicated FTP user ==="
if id "$FTP_USER" &>/dev/null; then
    echo "User $FTP_USER already exists, skipping creation"
else
    useradd -m -s /sbin/nologin "$FTP_USER"
    echo "Set a password for $FTP_USER:"
    passwd "$FTP_USER"
fi

echo "=== Giving $MAIN_USER full access to $FTP_USER home directory ==="
# Add cwhiii to ftpuser's group
usermod -aG "$FTP_USER" "$MAIN_USER"
# Set the home directory group to ftpuser so group perms apply
chown "$FTP_USER":"$FTP_USER" "/home/$FTP_USER"
# Owner + group get full rwx, others get nothing
chmod 770 "/home/$FTP_USER"
# Make new files inherit the group (setgid)
chmod g+s "/home/$FTP_USER"
# Set default ACL so all new files/dirs give group full access
setfacl -R -m g:"$FTP_USER":rwx "/home/$FTP_USER"
setfacl -R -d -m g:"$FTP_USER":rwx "/home/$FTP_USER"

echo "=== Configuring vsftpd ==="
cat > /etc/vsftpd/vsftpd.conf << 'EOF'
# Listen on IPv4 only
listen=YES
listen_ipv6=NO

# No anonymous access
anonymous_enable=NO

# Allow local users to log in
local_enable=YES
write_enable=YES
local_umask=022

# Lock users to their home directory
chroot_local_user=YES
allow_writeable_chroot=YES

# Passive mode
pasv_enable=YES
pasv_min_port=30000
pasv_max_port=31000

# Allow users with /sbin/nologin shell to use FTP
userlist_enable=NO
EOF

# vsftpd checks /etc/shells — add nologin so ftpuser can connect
if ! grep -q '/sbin/nologin' /etc/shells; then
    echo '/sbin/nologin' >> /etc/shells
fi

echo "=== Starting vsftpd ==="
systemctl restart vsftpd
systemctl enable vsftpd

echo ""
echo "=== Done ==="
echo "FTP server is running on port 21."
echo "Connect as '$FTP_USER' with the password you just set."
echo ""
echo "Your user '$MAIN_USER' has full read/write access to /home/$FTP_USER"
echo "(you may need to log out and back in for the group membership to take effect)"
echo ""
echo "Your laptop's IP:"
hostname -I
