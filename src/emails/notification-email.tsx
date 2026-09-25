import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// Branded notification email. Kept inline-styled: email clients ignore <style>.
export function NotificationEmail({
  title,
  body,
  actionUrl,
  actionLabel = "Open Elev8ai",
  preview,
}: {
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  actionLabel?: string;
  preview?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview ?? title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>
            Elev8<span style={{ color: "#33d17a" }}>ai</span>
          </Text>
          <Section style={card}>
            <Heading style={heading}>{title}</Heading>
            {body && <Text style={text}>{body}</Text>}
            {actionUrl && (
              <Button style={button} href={actionUrl}>
                {actionLabel}
              </Button>
            )}
          </Section>
          <Text style={footer}>
            You&apos;re getting this because you have an Elev8ai account. Manage email notifications
            in your profile settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NotificationEmail;

const main = { backgroundColor: "#0b1220", fontFamily: "-apple-system,Segoe UI,Roboto,sans-serif" };
const container = { margin: "0 auto", padding: "24px 12px", maxWidth: "480px" };
const brand = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#ffffff",
  textAlign: "center" as const,
};
const card = { backgroundColor: "#161f33", borderRadius: "14px", padding: "28px 24px" };
const heading = { fontSize: "20px", fontWeight: "600", color: "#ffffff", margin: "0 0 12px" };
const text = { fontSize: "15px", lineHeight: "1.6", color: "#c7d0e0", margin: "0 0 20px" };
const button = {
  backgroundColor: "#33d17a",
  borderRadius: "10px",
  color: "#0b1220",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
};
const footer = {
  fontSize: "12px",
  color: "#7b8699",
  textAlign: "center" as const,
  marginTop: "20px",
};
