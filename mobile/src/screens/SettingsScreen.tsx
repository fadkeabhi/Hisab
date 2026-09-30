import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useUnsavedChanges } from '../pwa';
import { useAuth } from '../auth';
import { useAction, useResource } from '../hooks';
import { ShopSettings } from '../types';
import {
  Button,
  Card,
  colors,
  ErrorText,
  Field,
  Heading,
  Loading,
  Page,
  styles,
} from '../components/ui';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
type PermissionKey = Exclude<keyof ShopSettings, 'attendance_mode' | 'hishob_mode'>;
type Permission = { key: PermissionKey; title: string; label: string; description: string };
const groups: { title: string; icon: Icon; description: string; items: Permission[] }[] = [
  {
    title: 'Manager · Hishob',
    icon: 'wallet-outline',
    description: 'Choose how managers help with the cash register.',
    items: [
      {
        key: 'manager_can_access_hishob',
        title: 'Hishob access',
        label: 'Managers can access Hishob',
        description:
          'View history, start today, update opening cash and add sales, expenses or customer payments.',
      },
      {
        key: 'manager_can_close_hishob',
        title: 'Close the day',
        label: 'Managers can close Hishob',
        description: 'Count cash and save the daily closing. Requires Hishob access.',
      },
    ],
  },
  {
    title: 'Attendance access',
    icon: 'calendar-outline',
    description: 'Set who can record attendance and see their own history.',
    items: [
      {
        key: 'manager_can_manage_attendance',
        title: 'Manage worker attendance',
        label: 'Managers can record and correct attendance',
        description: 'Managers can record arrivals, departures and correct workers’ attendance.',
      },
      {
        key: 'manager_can_mark_own_attendance',
        title: 'Manager self-attendance',
        label: 'Managers can mark their own attendance',
        description:
          'Managers can mark their own arrival and departure. Corrections require the owner.',
      },
      {
        key: 'workers_can_view_attendance',
        title: 'Worker attendance history',
        label: 'Workers can view their own attendance',
        description: 'Workers can view their own records. They cannot mark or edit attendance.',
      },
    ],
  },
  {
    title: 'Manager · Team',
    icon: 'people-outline',
    description: 'Delegate everyday worker administration.',
    items: [
      {
        key: 'manager_can_add_workers',
        title: 'Add workers',
        label: 'Managers can add workers',
        description: 'Add a worker using their name and mobile number.',
      },
      {
        key: 'manager_can_edit_workers',
        title: 'Edit worker profiles',
        label: 'Managers can edit and deactivate workers',
        description:
          'Change worker details, including mobile numbers, and deactivate or reactivate workers.',
      },
      {
        key: 'manager_can_reset_worker_passwords',
        title: 'Worker password resets',
        label: 'Managers can approve worker password resets',
        description: 'Approve reset requests and share one-time setup codes for workers.',
      },
    ],
  },
];

function SectionHeading({
  title,
  icon,
  description,
}: {
  title: string;
  icon: Icon;
  description?: string;
}) {
  return (
    <View style={local.sectionHeading}>
      <View style={local.sectionIcon}>
        <Ionicons name={icon} size={20} color={colors.green} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.heading}>{title}</Text>
        {description && <Text style={styles.small}>{description}</Text>}
      </View>
    </View>
  );
}

function Choice({
  title,
  description,
  icon,
  selected,
  label = title,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  icon: Icon;
  selected: boolean;
  label?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        local.choice,
        selected && local.selectedChoice,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={21} color={colors.green} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={local.optionTitle}>{title}</Text>
        <Text style={styles.small}>{description}</Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={21}
        color={selected ? colors.green : colors.muted}
      />
    </Pressable>
  );
}

function SettingsForm({ initial }: { initial: ShopSettings }) {
  const { selected, api, reload } = useAuth();
  const [settings, setSettings] = useState(initial);
  const [name, setName] = useState(selected!.shop.name);
  const [baseline, setBaseline] = useState({ settings: initial, name: selected!.shop.name });
  const [saved, setSaved] = useState(false);
  const dirty =
    name.trim() !== baseline.name || JSON.stringify(settings) !== JSON.stringify(baseline.settings);
  const validName = name.trim().length >= 2 && name.trim().length <= 100;
  useUnsavedChanges(dirty);
  const action = useAction();
  const change = (patch: Partial<ShopSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSaved(false);
  };
  return (
    <View style={{ flex: 1 }}>
      <Page>
        <Heading title="Shop settings" subtitle="Your shop, daily routines and team access." />
        <Card>
          <SectionHeading title="Shop details" icon="storefront-outline" />
          <Field
            label="Shop name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            editable={!action.busy}
            onChangeText={(value) => {
              setName(value);
              setSaved(false);
            }}
            placeholder="e.g. Market Road Store"
          />
          <View style={local.infoRow}>
            <Ionicons name="time-outline" size={18} color={colors.muted} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={local.optionTitle}>Business timezone</Text>
              <Text style={styles.small}>{selected!.shop.timezone}</Text>
            </View>
          </View>
          <Text style={styles.small}>
            Attendance and Hishob dates follow this timezone, set when the shop was created.
          </Text>
        </Card>
        <Card>
          <SectionHeading
            title="Sales method"
            icon="calculator-outline"
            description="Choose how you work out each day’s sales."
          />
          {(
            [
              {
                value: 'ENTRIES',
                title: 'Enter sales',
                icon: 'receipt-outline',
                description:
                  'Record individual sales or totals by payment type. Compare expected cash with your closing count.',
              },
              {
                value: 'COUNTED',
                title: 'Count cash',
                icon: 'cash-outline',
                description:
                  'Record expenses, then count cash to estimate sales. Cash shortages cannot be measured independently.',
              },
              {
                value: 'BILLING',
                title: 'Use billing totals',
                icon: 'print-outline',
                description:
                  'Enter your billing total at closing. Add payment totals when available to check the cash difference.',
              },
            ] as const
          ).map((option) => (
            <Choice
              key={option.value}
              {...option}
              label={`Hishob method: ${option.title}`}
              selected={settings.hishob_mode === option.value}
              disabled={action.busy}
              onPress={() => change({ hishob_mode: option.value })}
            />
          ))}
          <Text style={styles.small}>
            Applies to newly started Hishob days. Existing days keep their saved method.
          </Text>
        </Card>
        <Card>
          <SectionHeading
            title="Workday tracking"
            icon="checkmark-done-outline"
            description="Keep attendance as simple as your shop needs."
          />
          <Choice
            title="Check-in only"
            icon="log-in-outline"
            description="Record arrival once. Best for a simple daily register."
            selected={settings.attendance_mode === 'CHECK_IN_ONLY'}
            disabled={action.busy}
            onPress={() => change({ attendance_mode: 'CHECK_IN_ONLY' })}
          />
          <Choice
            title="Check-in and check-out"
            icon="swap-horizontal-outline"
            description="Record both arrival and departure."
            selected={settings.attendance_mode === 'CHECK_IN_OUT'}
            disabled={action.busy}
            onPress={() => change({ attendance_mode: 'CHECK_IN_OUT' })}
          />
          <Text style={styles.small}>
            Existing open shifts can still be closed after changing this setting.
          </Text>
        </Card>
        <View style={{ gap: 5 }}>
          <Text style={styles.heading}>Team permissions</Text>
          <Text style={styles.small}>
            Applies to this shop only. Changes take effect after saving.
          </Text>
        </View>
        {groups.map((group) => (
          <Card key={group.title}>
            <SectionHeading title={group.title} icon={group.icon} description={group.description} />
            {group.items.map((item) => {
              const needsAccess =
                item.key === 'manager_can_close_hishob' && !settings.manager_can_access_hishob;
              return (
                <View key={item.key} style={local.permission}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={local.optionTitle}>{item.title}</Text>
                    <Text style={styles.small}>
                      {needsAccess
                        ? 'Enable Hishob access above to allow managers to close a day.'
                        : item.description}
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel={item.label}
                    disabled={action.busy || needsAccess}
                    value={!needsAccess && settings[item.key]}
                    onValueChange={(value) => change({ [item.key]: value })}
                    trackColor={{ false: '#D4DCD5', true: colors.green }}
                  />
                </View>
              );
            })}
          </Card>
        ))}
        <View style={local.ownerNote}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.green} />
          <Text style={[styles.small, { flex: 1 }]}>
            Only the owner can change settings, manage managers, open missed Hishob days, reopen
            closed days, or correct and delete financial entries.
          </Text>
        </View>
      </Page>
      <View style={local.footer}>
        <View style={local.footerContent}>
          <ErrorText message={action.error} />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.small, saved && !dirty && { color: colors.green }]}
          >
            {dirty
              ? 'You have unsaved changes.'
              : saved
                ? 'Shop settings saved.'
                : 'All changes saved.'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {dirty && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discard changes"
                disabled={action.busy}
                onPress={() => {
                  setSettings(baseline.settings);
                  setName(baseline.name);
                  setSaved(false);
                }}
                style={local.discard}
              >
                <Text style={local.optionTitle}>Discard</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save shop settings"
              accessibilityState={{
                disabled: !dirty || !validName || action.busy,
                busy: action.busy,
              }}
              disabled={!dirty || !validName || action.busy}
              style={({ pressed }) => [
                local.save,
                { opacity: !dirty || !validName || action.busy ? 0.5 : pressed ? 0.75 : 1 },
              ]}
              onPress={() =>
                void action.run(async () => {
                  const submitted = { settings, name: name.trim() };
                  const result = await api<ShopSettings>(
                    `/shops/${selected!.shop_id}/settings`,
                    { ...submitted.settings, shop_name: submitted.name },
                    'PUT',
                  );
                  setSettings(result);
                  setName(submitted.name);
                  setBaseline({ settings: result, name: submitted.name });
                  setSaved(true);
                  await reload();
                })
              }
            >
              {action.busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Ionicons name="checkmark-outline" size={19} color={colors.white} />
              )}
              <Text style={local.saveLabel}>{action.busy ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ShopSettingsScreen() {
  const { selected } = useAuth();
  const resource = useResource<ShopSettings>(`/shops/${selected!.shop_id}/settings`);
  if (!selected!.permissions.manage_settings)
    return (
      <Page>
        <Heading title="Owner access required" />
      </Page>
    );
  if (resource.data) return <SettingsForm key={selected!.shop_id} initial={resource.data} />;
  return (
    <Page>
      <Heading title="Shop settings" subtitle={selected!.shop.name} />
      <ErrorText message={resource.error} />
      {resource.loading && <Loading />}
      {!!resource.error && (
        <Button title="Retry settings" secondary onPress={() => void resource.refresh()} />
      )}
    </Page>
  );
}

const local = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#F5F7F2',
    borderRadius: 12,
    padding: 12,
  },
  choice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    minHeight: 60,
  },
  selectedChoice: { borderColor: colors.green, backgroundColor: colors.mint },
  permission: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ownerNote: { flexDirection: 'row', gap: 10, padding: 4 },
  footer: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  footerContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  save: {
    flex: 1,
    minHeight: 48,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.green,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
  discard: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
});
