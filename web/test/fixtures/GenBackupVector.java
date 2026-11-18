import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Independent oracle for web/src/backup/crypto.ts: same javax.crypto calls as BackupCrypto.kt
 * (Android app). Regenerate the vector with:
 *   java GenBackupVector.java android-sample.json > android-vector.json
 * Fixed salt/IV and a throwaway password: fictional data only.
 */
public class GenBackupVector {
    public static void main(String[] args) throws Exception {
        String password = "mot de passe é🔐 №1";
        int iterations = 600_000;
        byte[] salt = new byte[16];
        byte[] iv = new byte[12];
        for (int i = 0; i < salt.length; i++) salt[i] = (byte) (i * 7 + 3);
        for (int i = 0; i < iv.length; i++) iv[i] = (byte) (255 - i * 11);
        byte[] plain = Files.readAllBytes(Path.of(args[0]));

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        out.write("IBDJENC1".getBytes(StandardCharsets.US_ASCII));
        out.writeInt(iterations);
        out.write(salt);
        out.write(iv);
        byte[] header = bytes.toByteArray();

        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
        byte[] key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        cipher.updateAAD(header);
        byte[] body = cipher.doFinal(plain);

        byte[] file = new byte[header.length + body.length];
        System.arraycopy(header, 0, file, 0, header.length);
        System.arraycopy(body, 0, file, header.length, body.length);
        System.out.println("{\"password\":\"" + password + "\",\"iterations\":" + iterations
            + ",\"fileBase64\":\"" + Base64.getEncoder().encodeToString(file) + "\"}");
    }
}
