/**
 * Kitchen-sink page — renders all UI component variants for visual verification.
 *
 * Expo Router route: /kitchen-sink
 */

import { ScrollView, View, Text } from "@/tw";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Badge,
  Separator,
  Spinner,
  EmptyState,
} from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-lg font-semibold text-ctp-text">{title}</Text>
      <View className="flex-col gap-3">{children}</View>
    </View>
  );
}

export default function KitchenSink() {
  return (
    <ScrollView
      className="flex-1 bg-ctp-base"
      contentContainerClassName="p-6 gap-4"
    >
      <Text className="mb-2 text-2xl font-bold text-ctp-text">
        Component Kitchen Sink
      </Text>
      <Text className="mb-4 text-ctp-subtext1">
        NativeWind + Catppuccin UI kit preview
      </Text>

      {/* ── Buttons ──────────────────────────────────────────────── */}
      <Section title="Button">
        <Text className="mb-2 text-sm font-medium text-ctp-subtext0">Variant: primary (default)</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="primary">Small</Button>
          <Button size="md" variant="primary">Medium</Button>
          <Button size="lg" variant="primary">Large</Button>
          <Button size="icon" variant="primary">?</Button>
        </View>

        <Text className="mt-3 mb-2 text-sm font-medium text-ctp-subtext0">Variant: secondary</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="md" variant="secondary">Medium</Button>
          <Button size="lg" variant="secondary">Large</Button>
        </View>

        <Text className="mt-3 mb-2 text-sm font-medium text-ctp-subtext0">Variant: outline</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline">Small</Button>
          <Button size="md" variant="outline">Medium</Button>
          <Button size="lg" variant="outline">Large</Button>
        </View>

        <Text className="mt-3 mb-2 text-sm font-medium text-ctp-subtext0">Variant: ghost</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="ghost">Small</Button>
          <Button size="md" variant="ghost">Medium</Button>
          <Button size="lg" variant="ghost">Large</Button>
        </View>

        <Text className="mt-3 mb-2 text-sm font-medium text-ctp-subtext0">Variant: destructive</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="destructive">Delete</Button>
          <Button size="md" variant="destructive">Delete</Button>
        </View>

        <Text className="mt-3 mb-2 text-sm font-medium text-ctp-subtext0">State: disabled</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="md" variant="primary" disabled>Primary</Button>
          <Button size="md" variant="secondary" disabled>Secondary</Button>
          <Button size="md" variant="outline" disabled>Outline</Button>
        </View>

        <Text className="mt-3 mb-2 text-sm font-medium text-ctp-subtext0">State: loading</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="md" variant="primary" loading>Primary</Button>
          <Button size="md" variant="secondary" loading>Secondary</Button>
        </View>
      </Section>

      <Separator />

      {/* ── Cards ────────────────────────────────────────────────── */}
      <Section title="Card">
        <Card>
          <CardHeader>
            <CardTitle>Basic Card</CardTitle>
            <CardDescription>
              A simple card with header, content, and footer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-ctp-text">
              This is the main content area. Cards provide a clean way to
              group related information.
            </Text>
          </CardContent>
          <CardFooter>
            <Button size="sm" variant="outline">Cancel</Button>
            <Button size="sm" variant="primary">Save</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardContent>
            <Text className="text-ctp-text">
              A minimal card with just content — no header or footer.
            </Text>
          </CardContent>
        </Card>
      </Section>

      <Separator />

      {/* ── Inputs ───────────────────────────────────────────────── */}
      <Section title="Input">
        <Input
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <Input
          label="Password"
          placeholder="Enter password"
          secureTextEntry
          hint="At least 8 characters"
        />
        <Input
          label="With error"
          placeholder="Something wrong"
          value="bad input"
          error="This field has an error"
        />
        <Input
          label="Disabled"
          value="Cannot edit"
          editable={false}
        />
      </Section>

      <Separator />

      {/* ── Badges ───────────────────────────────────────────────── */}
      <Section title="Badge">
        <View className="flex-row flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
        </View>
        <Text className="mt-2 text-sm text-ctp-subtext1">
          Use these for FSRS grades, annotation kinds, and status indicators.
        </Text>
      </Section>

      <Separator />

      {/* ── Spinner ──────────────────────────────────────────────── */}
      <Section title="Spinner">
        <View className="flex-row items-end gap-6">
          <Spinner size="sm" label="small" />
          <Spinner size="md" label="medium" />
          <Spinner size="lg" label="large" />
        </View>
      </Section>

      <Separator />

      {/* ── EmptyState ───────────────────────────────────────────── */}
      <Section title="EmptyState">
        <EmptyState
          title="No documents yet"
          description="Import a PDF to get started with reading and vocabulary building."
          action={{ label: "Import PDF", onPress: () => {} }}
        />
      </Section>

      <Separator />

      {/* ── Separator ────────────────────────────────────────────── */}
      <Section title="Separator">
        <Text className="text-ctp-text">Above the separator</Text>
        <Separator className="my-2" />
        <Text className="text-ctp-text">Below the separator</Text>
      </Section>
    </ScrollView>
  );
}
