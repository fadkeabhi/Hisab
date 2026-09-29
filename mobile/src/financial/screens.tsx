import { Calculator } from './Calculator';
import { InfoHelp } from '../components/InfoHelp';
import { HelpButton as Button, FinancialHelp, financialHelp, transactionHelp } from './help';
import React, { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useUnsavedChanges } from '../pwa';
import { useAuth } from '../auth';
import { useAction, useResource } from '../hooks';
import {
  Card,
  EmptyState,
  ErrorText,
  Field,
  Heading,
  Loading,
  Page,
  styles,
} from '../components/ui';
import { FilterChips, SearchField } from '../components/ListControls';
import { Routes } from '../types';
import { Breakdown, Galla, MoneyField, timestamp, TransactionTypeFilter } from './components';
import { money, parseMoney, signedPaise } from './money';
import { CloseForm } from './closing';
import { Day, Entry, TodayHishob, TransactionType, transactionTypes, modeLabels } from './types';
export { HishobHistory } from './history';

function NewDay({ initial, refresh }: { initial: TodayHishob; refresh: () => Promise<void> }) {
  const { api, selected } = useAuth();
  // Follow refreshed carry-forward cash until the owner explicitly edits it.
  const [openingDraft, setOpening] = useState<string | null>(null);
  const opening = openingDraft ?? initial.suggested_opening_cash ?? '';
  const [reason, setReason] = useState('');
  const action = useAction();
  useUnsavedChanges(opening !== (initial.suggested_opening_cash || '') || !!reason);
  const override =
    initial.suggested_opening_cash !== null &&
    parseMoney(opening) !== signedPaise(initial.suggested_opening_cash);
  return (
    <>
      <Card>
        <Text style={styles.heading}>{modeLabels[selected!.shop.settings.hishob_mode]}</Text>
        <Text style={styles.small}>
          Choose how sales are recorded in Account → Shop settings before starting. Record expenses
          as they happen, then count and close.
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Start with the cash in your galla</Text>
        <Text style={styles.subtitle}>
          {initial.previous_closed_date
            ? `Carried from the actual closing cash on ${initial.previous_closed_date}.`
            : 'This is your first day. Count the cash you are starting with.'}
        </Text>
        <MoneyField label="Opening cash" value={opening} onChange={setOpening} />
        {override && (
          <Field
            required
            minLength={2}
            label="Opening change reason"
            value={reason}
            onChangeText={setReason}
            maxLength={500}
            placeholder="Why is the opening different?"
          />
        )}
      </Card>
      <ErrorText message={action.error} />
      <Button
        title="Start today’s Hishob"
        busy={action.busy}
        disabled={parseMoney(opening) === null || (override && reason.trim().length < 2)}
        onPress={() =>
          void action.run(async () => {
            await api(
              `/shops/${selected!.shop_id}/hishob/days`,
              { opening_cash: opening.trim(), reason },
              'POST',
            );
            await refresh();
          })
        }
      />
    </>
  );
}

export function HishobToday({ navigation }: NativeStackScreenProps<Routes, 'HishobToday'>) {
  const { selected } = useAuth();
  const resource = useResource<TodayHishob>(`/shops/${selected!.shop_id}/hishob/today`, true);
  const day = resource.data?.day;
  return (
    <Page refresh={resource.refresh}>
      <Heading
        title="Today’s Hishob"
        subtitle={`${selected!.shop.name} · ${resource.data?.date || 'Your daily cash register'}`}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View>
          <Button
            title="Search"
            accessibilityLabel="Search transactions"
            secondary
            onPress={() => navigation.navigate('HishobSearch')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Calendar & sales"
            accessibilityLabel="Hishob history"
            secondary
            onPress={() => navigation.navigate('HishobHistory')}
          />
        </View>
        <Calculator />
      </View>
      <Button title="Customer dues" secondary onPress={() => navigation.navigate('CustomerDues')} />
      <ErrorText message={resource.error} />
      {resource.loading && <Loading />}
      {!day && selected!.permissions.manage_settings && (
        <Button
          title="Choose Hishob method"
          secondary
          onPress={() => navigation.navigate('ShopSettings')}
        />
      )}
      {resource.data && !day && (
        <NewDay
          key={`${selected!.shop_id}:${resource.data.date}`}
          initial={resource.data}
          refresh={resource.refresh}
        />
      )}
      {day && (
        <>
          <Text style={styles.eyebrow}>
            {day.status === 'CLOSED' ? 'DAY CLOSED' : 'DAY OPEN'} ·{' '}
            {modeLabels[day.mode || 'ENTRIES']}
          </Text>
          <Galla
            current={day.status === 'OPEN'}
            expected={day.expected_closing_cash}
            {...(day.status === 'CLOSED'
              ? { actual: day.actual_closing_cash, difference: day.difference }
              : {})}
          />
          {day.status === 'OPEN' && (
            <Button
              title="Add transaction"
              onPress={() => navigation.navigate('HishobTransaction', { dayId: day.id })}
            />
          )}
          {day.mode && day.mode !== 'ENTRIES' && day.status === 'OPEN' && (
            <Text style={styles.subtitle}>
              Record expenses and cash movements now.{' '}
              {day.mode === 'COUNTED'
                ? 'Cash sales will be estimated when you count at closing.'
                : 'Enter your billing totals when you close the day.'}
            </Text>
          )}
          <Breakdown day={day} />
          <Button
            title={`View transactions (${day.transactions.filter((entry) => !entry.deleted).length})`}
            secondary
            onPress={() => navigation.navigate('HishobTransactions', { dayId: day.id })}
          />
          {day.status === 'OPEN' && selected!.permissions.close_hishob && (
            <Button
              title="Close day"
              onPress={() => navigation.navigate('HishobClose', { dayId: day.id })}
            />
          )}
          <Button
            title="Day details & audit"
            secondary
            onPress={() => navigation.navigate('HishobDetails', { dayId: day.id })}
          />
        </>
      )}
    </Page>
  );
}

function TransactionForm({
  initial: loaded,
  entryId,
  initialType,
  done,
}: {
  initial: Day;
  entryId?: string;
  initialType?: 'CREDIT_SALE';
  done: () => void;
}) {
  const [initial] = useState(loaded);
  const { api, selected } = useAuth();
  const entry = initial.transactions.find((item) => item.id === entryId);
  const [type, setType] = useState<TransactionType>(
    entry?.type ||
      initialType ||
      (initial.mode && initial.mode !== 'ENTRIES' ? 'EXPENSE' : 'CASH_SALE'),
  );
  const [payment, setPayment] = useState<'CASH' | 'DIGITAL'>(entry?.payment_method || 'CASH');
  const [amount, setAmount] = useState(entry?.amount || '');
  const [description, setDescription] = useState(entry?.description || '');
  const [customer, setCustomer] = useState(entry?.customer_name || '');
  const [category, setCategory] = useState(entry?.category || '');
  const [reason, setReason] = useState('');
  const [requestId] = useState(
    () => `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  );
  const action = useAction();
  useUnsavedChanges(
    customer !== (entry?.customer_name || '') ||
      amount !== (entry?.amount || '') ||
      description !== (entry?.description || '') ||
      category !== (entry?.category || '') ||
      type !== (entry?.type || 'CASH_SALE') ||
      payment !== (entry?.payment_method || 'CASH') ||
      !!reason,
  );
  if (initial.status !== 'OPEN' || (entryId && (!entry || entry.deleted)))
    return <ErrorText message="This entry is no longer editable. Go back and refresh the day." />;
  return (
    <>
      <Text style={styles.small}>
        Required fields are labelled. Explain corrections before saving.
      </Text>
      {entryId && (
        <Field
          required
          minLength={2}
          label="Correction reason"
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          autoFocus
          placeholder="e.g. Amount was entered incorrectly"
        />
      )}
      <FilterChips
        label="Transaction type"
        options={transactionTypes
          .filter(
            (item) =>
              item.type !== 'DUE_COLLECTION' &&
              (!initial.mode ||
                initial.mode === 'ENTRIES' ||
                !['CASH_SALE', 'DIGITAL_SALE'].includes(item.type)),
          )
          .map((item) => ({ value: item.type, label: item.label }))}
        value={type}
        onChange={setType}
      />
      <InfoHelp key={type} title={transactionTypes.find((item) => item.type === type)!.label}>
        {transactionHelp[type]}
      </InfoHelp>
      {(type === 'EXPENSE' || type === 'SUPPLIER_PAYMENT') && (
        <FilterChips
          label="Paid from"
          value={payment}
          onChange={setPayment}
          options={[
            { value: 'CASH', label: 'Cash from galla' },
            { value: 'DIGITAL', label: 'UPI / bank / card' },
          ]}
        />
      )}
      {(type === 'EXPENSE' || type === 'SUPPLIER_PAYMENT') && <FinancialHelp topic="Paid from" />}
      <Card>
        {type === 'CREDIT_SALE' && (
          <Field
            required
            minLength={2}
            label="Customer name / bill reference"
            value={customer}
            onChangeText={setCustomer}
            maxLength={100}
            placeholder="e.g. Ravi · Bill 42"
          />
        )}
        <MoneyField label="Amount (₹)" value={amount} onChange={setAmount} />
        <Field
          required
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Tea, transport, cash sales"
          maxLength={300}
        />
        <Field
          label="Category (optional)"
          help={financialHelp['Category (optional)']}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Shop expenses"
          maxLength={80}
        />
      </Card>
      <ErrorText message={action.error} />
      <Button
        title={entryId ? 'Save correction' : 'Save transaction'}
        busy={action.busy}
        disabled={
          parseMoney(amount) === null ||
          parseMoney(amount) === BigInt(0) ||
          !description.trim() ||
          (type === 'CREDIT_SALE' && !customer.trim()) ||
          (!!entryId && reason.trim().length < 2)
        }
        onPress={() =>
          void action.run(async () => {
            await api(
              `/shops/${selected!.shop_id}/hishob/days/${initial.id}/transactions${entryId ? '/' + entryId : ''}`,
              {
                revision: initial.revision,
                type,
                amount: amount.trim(),
                payment_method:
                  type === 'EXPENSE' || type === 'SUPPLIER_PAYMENT' ? payment : 'CASH',
                description,
                customer_name: customer,
                category,
                ...(entryId ? { reason } : { request_id: requestId }),
              },
              entryId ? 'PATCH' : 'POST',
            );
            done();
          })
        }
      />
      <Text style={styles.small}>
        Keep this form open until the save is confirmed. If the day changes on another device, go
        back and refresh before saving again.
      </Text>
    </>
  );
}
export function HishobTransaction({
  route,
  navigation,
}: NativeStackScreenProps<Routes, 'HishobTransaction'>) {
  const { selected } = useAuth();
  const resource = useResource<Day>(
    `/shops/${selected!.shop_id}/hishob/days/${route.params.dayId}`,
  );
  return (
    <Page>
      <Heading
        title={route.params.entryId ? 'Correct transaction' : 'Add transaction'}
        subtitle="One amount. One clear entry."
      />
      <ErrorText message={resource.error} />
      {resource.loading && <Loading />}
      {resource.data && (
        <TransactionForm
          initial={resource.data}
          entryId={route.params.entryId}
          initialType={route.params.initialType}
          done={() => navigation.goBack()}
        />
      )}
    </Page>
  );
}

export function EntryCard({
  entry,
  zone,
  edit,
  remove,
  footer,
}: {
  entry: Entry;
  zone: string;
  edit?: () => void;
  remove?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <View style={styles.row}>
        <Text style={[styles.heading, { flex: 1 }]}>{entry.description}</Text>
        <Text style={styles.heading}>{money(entry.amount)}</Text>
      </View>
      <Text style={styles.small}>
        {transactionTypes.find((type) => type.type === entry.type)?.label}
        {entry.type === 'EXPENSE' ||
        entry.type === 'SUPPLIER_PAYMENT' ||
        entry.type === 'DUE_COLLECTION'
          ? ` · ${entry.payment_method === 'DIGITAL' ? 'Digital' : 'Cash'}`
          : ''}
        {entry.category ? ` · ${entry.category}` : ''}
        {entry.deleted ? ' · Deleted' : ''}
      </Text>
      <Text style={styles.small}>
        Added by {entry.created_by.name} · {timestamp(entry.created_at, zone)}
      </Text>
      {entry.updated_by && (
        <Text style={styles.small}>
          Changed by {entry.updated_by.name} · {timestamp(entry.updated_at, zone)}
        </Text>
      )}
      {entry.deleted_by && <Text style={styles.small}>Deleted by {entry.deleted_by.name}</Text>}
      {(edit || remove) && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          {edit && <Button title={`Edit · ${entry.description}`} secondary onPress={edit} />}
          {remove && <Button title={`Delete · ${entry.description}`} secondary onPress={remove} />}
        </View>
      )}
      {footer}
    </Card>
  );
}
export function HishobTransactions({
  route,
  navigation,
}: NativeStackScreenProps<Routes, 'HishobTransactions'>) {
  const { selected, api } = useAuth();
  const resource = useResource<Day>(
    `/shops/${selected!.shop_id}/hishob/days/${route.params.dayId}`,
    true,
  );
  const [filter, setFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TransactionType | 'ALL'>('ALL');
  const [deleting, setDeleting] = useState<{ entry: Entry; revision: number } | null>(null);
  const [reason, setReason] = useState('');
  const action = useAction();
  const editable =
    selected!.permissions.edit_hishob_transactions && resource.data?.status === 'OPEN';
  const entries =
    resource.data?.transactions.filter(
      (entry) =>
        (filter === 'ALL' || !entry.deleted) &&
        (type === 'ALL' || entry.type === type) &&
        [entry.description, entry.category, entry.created_by.name].some((text) =>
          text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        ),
    ) || [];
  return (
    <Page refresh={resource.refresh}>
      <Heading title="Transactions" subtitle={resource.data?.date} />
      <SearchField
        label="Search this day’s transactions"
        placeholder="Description, category or recorded by"
        value={query}
        onChange={setQuery}
      />
      <TransactionTypeFilter value={type} onChange={setType} />
      <Button
        title="Search across all dates"
        secondary
        onPress={() => navigation.navigate('HishobSearch')}
      />
      {resource.data?.status === 'OPEN' && (
        <Button
          title="Add transaction"
          onPress={() => navigation.navigate('HishobTransaction', { dayId: route.params.dayId })}
        />
      )}
      <FilterChips
        label="Entries"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'ACTIVE', label: 'Active entries' },
          { value: 'ALL', label: 'Include deleted' },
        ]}
      />
      <ErrorText message={resource.error || action.error} />
      {resource.loading && <Loading />}
      {deleting && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => {
            if (!action.busy) setDeleting(null);
          }}
        >
          <Page topInset>
            <Card>
              <Text style={styles.heading}>Delete {deleting.entry.description}?</Text>
              <Text style={styles.small}>
                The entry remains in the audit trail but is removed from totals.
              </Text>
              <Field
                required
                minLength={2}
                label="Deletion reason"
                autoFocus
                placeholder="e.g. Duplicate entry"
                value={reason}
                onChangeText={setReason}
                maxLength={500}
              />
              <ErrorText message={action.error} />
              <Button
                title="Confirm deletion"
                danger
                busy={action.busy}
                disabled={reason.trim().length < 2}
                onPress={() =>
                  void action.run(async () => {
                    await api(
                      `/shops/${selected!.shop_id}/hishob/days/${route.params.dayId}/transactions/${deleting.entry.id}/delete`,
                      { revision: deleting.revision, reason },
                      'POST',
                    );
                    setDeleting(null);
                    setReason('');
                    await resource.refresh();
                  })
                }
              />
              <Button
                title="Cancel deletion"
                secondary
                disabled={action.busy}
                onPress={() => setDeleting(null)}
              />
            </Card>
          </Page>
        </Modal>
      )}
      {resource.data && entries.length === 0 && (
        <EmptyState
          title={query || type !== 'ALL' ? 'No matching transactions' : 'No entries yet'}
          description={
            query || type !== 'ALL'
              ? 'Try another search or transaction type.'
              : 'Add a sale, expense or another cash movement.'
          }
        />
      )}
      {entries.map((entry) => (
        <View key={entry.id} style={{ gap: 8 }}>
          <EntryCard
            entry={entry}
            zone={selected!.shop.timezone}
            remove={
              editable && !entry.deleted && entry.type !== 'DUE_COLLECTION'
                ? () => {
                    setDeleting({ entry, revision: resource.data!.revision });
                    setReason('');
                  }
                : undefined
            }
            edit={
              editable && !entry.deleted && entry.type !== 'DUE_COLLECTION'
                ? () =>
                    navigation.navigate('HishobTransaction', {
                      dayId: route.params.dayId,
                      entryId: entry.id,
                    })
                : undefined
            }
          />
        </View>
      ))}
    </Page>
  );
}

export function HishobClose({ route, navigation }: NativeStackScreenProps<Routes, 'HishobClose'>) {
  const { selected } = useAuth();
  const resource = useResource<Day>(
    `/shops/${selected!.shop_id}/hishob/days/${route.params.dayId}`,
  );
  return (
    <Page>
      <Heading title="Close the day" subtitle={resource.data?.date} />
      <ErrorText message={resource.error} />
      {resource.loading && <Loading />}
      {resource.data && (
        <CloseForm
          initial={resource.data}
          done={() => navigation.replace('HishobDetails', { dayId: route.params.dayId })}
        />
      )}
    </Page>
  );
}

function ChangeOpening({ initial: loaded, done }: { initial: Day; done: () => Promise<void> }) {
  const [initial] = useState(loaded);
  const { api, selected } = useAuth();
  const [opening, setOpening] = useState(initial.opening_cash);
  const [reason, setReason] = useState('');
  useUnsavedChanges(opening !== initial.opening_cash || !!reason);
  const action = useAction();
  return (
    <Card>
      <MoneyField label="Updated opening cash" value={opening} onChange={setOpening} />
      <Field
        required
        minLength={2}
        label="Opening correction reason"
        value={reason}
        onChangeText={setReason}
        maxLength={500}
      />
      <ErrorText message={action.error} />
      <Button
        title="Save opening cash"
        busy={action.busy}
        disabled={parseMoney(opening) === null || reason.trim().length < 2}
        onPress={() =>
          void action.run(async () => {
            await api(
              `/shops/${selected!.shop_id}/hishob/days/${initial.id}/opening`,
              { revision: initial.revision, opening_cash: opening.trim(), reason },
              'PATCH',
            );
            await done();
          })
        }
      />
    </Card>
  );
}
function AuditValues({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <Text style={styles.small}>—</Text>;
  return (
    <Text style={styles.small}>
      {Object.entries(value)
        .filter(([key]) =>
          [
            'type',
            'amount',
            'description',
            'category',
            'deleted',
            'opening_cash',
            'actual_closing_cash',
            'expected_closing_cash',
            'difference',
            'counted_cash',
            'closing_bank_deposit',
            'closing_withdrawal',
            'payment_method',
            'reported_sales',
            'billing_input',
            'status',
          ].includes(key),
        )
        .map(
          ([key, entry]) =>
            `${key.replaceAll('_', ' ')}: ${typeof entry === 'object' && entry !== null ? JSON.stringify(entry) : (entry ?? '—')}`,
        )
        .join(' · ') || 'Day created'}
    </Text>
  );
}
export function HishobDetails({
  route,
  navigation,
}: NativeStackScreenProps<Routes, 'HishobDetails'>) {
  const { selected, api } = useAuth();
  const resource = useResource<Day>(
    `/shops/${selected!.shop_id}/hishob/days/${route.params.dayId}`,
    true,
  );
  const [opening, setOpening] = useState<Day | null>(null);
  const [reopenRevision, setReopenRevision] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [showAudit, setShowAudit] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const action = useAction();
  const day = resource.data;
  return (
    <Page refresh={resource.refresh}>
      <Heading
        title="Hishob day details"
        subtitle={day ? `${day.date} · ${day.status}` : selected!.shop.name}
      />
      <ErrorText message={resource.error || action.error} />
      {resource.loading && <Loading />}
      {day && (
        <>
          <Galla
            current={day.status === 'OPEN'}
            expected={day.expected_closing_cash}
            actual={day.actual_closing_cash}
            difference={day.difference}
          />
          <Breakdown day={day} />
          {day.opening_source && (
            <Text style={styles.small}>
              Opening carried from {day.opening_source.date}:{' '}
              {money(day.opening_source.actual_closing_cash)}. Later corrections do not change this
              day’s opening automatically.
            </Text>
          )}
          {day.closed_by && (
            <Text style={styles.small}>
              Closed by {day.closed_by.name} · {timestamp(day.closed_at!, day.timezone)}
            </Text>
          )}
          {day.difference_note ? (
            <Text style={styles.subtitle}>Difference note: {day.difference_note}</Text>
          ) : null}
          {day.notes ? <Text style={styles.subtitle}>Notes: {day.notes}</Text> : null}
          <Button
            title={`View transactions (${day.transactions.filter((entry) => !entry.deleted).length})`}
            secondary
            onPress={() => navigation.navigate('HishobTransactions', { dayId: day.id })}
          />
          {day.status === 'OPEN' && (
            <>
              <Button
                title="Add transaction"
                onPress={() => navigation.navigate('HishobTransaction', { dayId: day.id })}
              />
              <Button title="Change opening cash" secondary onPress={() => setOpening(day)} />
              {selected!.permissions.close_hishob && (
                <Button
                  title="Close day"
                  onPress={() => navigation.navigate('HishobClose', { dayId: day.id })}
                />
              )}
            </>
          )}
          {opening && day.status === 'OPEN' && (
            <>
              <ChangeOpening
                initial={opening}
                done={async () => {
                  setOpening(null);
                  await resource.refresh();
                }}
              />
              <Button title="Cancel opening change" secondary onPress={() => setOpening(null)} />
            </>
          )}
          {day.status === 'CLOSED' && selected!.permissions.reopen_hishob && (
            <Button title="Reopen day" secondary onPress={() => setReopenRevision(day.revision)} />
          )}
          {reopenRevision !== null && day.status === 'CLOSED' && (
            <Card>
              <Text style={styles.subtitle}>
                The original closing is kept. Changes will be recorded in the audit trail and
                carried openings on other days remain unchanged.
              </Text>
              <Field
                required
                minLength={2}
                label="Reopening reason"
                value={reason}
                onChangeText={setReason}
                maxLength={500}
              />
              <Button
                title="Confirm reopening"
                busy={action.busy}
                disabled={reason.trim().length < 2}
                onPress={() =>
                  void action.run(async () => {
                    await api(
                      `/shops/${selected!.shop_id}/hishob/days/${day.id}/reopen`,
                      { revision: reopenRevision, reason },
                      'POST',
                    );
                    setReopenRevision(null);
                    setReason('');
                    await resource.refresh();
                  })
                }
              />
              <Button
                title="Cancel reopening"
                secondary
                disabled={action.busy}
                onPress={() => setReopenRevision(null)}
              />
            </Card>
          )}
          {day.closing_snapshots.length > 0 && (
            <Text style={styles.heading}>Preserved closings</Text>
          )}
          {day.closing_snapshots.map((item, index) => (
            <Card key={item.snapshot_id}>
              <Text style={styles.heading}>
                Closing {index + 1} ·{' '}
                {item.mode === 'COUNTED'
                  ? 'Cash-count estimate'
                  : item.difference === null
                    ? 'Cash difference unavailable'
                    : money(item.difference, true)}
              </Text>
              <Text style={styles.small}>
                {item.closed_by.name} · {timestamp(item.closed_at, day.timezone)}
              </Text>
              <Button
                title={`View closing ${index + 1}`}
                secondary
                onPress={() => setSnapshot(snapshot === item.snapshot_id ? null : item.snapshot_id)}
              />
              {snapshot === item.snapshot_id && (
                <>
                  <Breakdown day={item} />
                  <Galla
                    expected={item.expected_closing_cash}
                    actual={item.actual_closing_cash}
                    difference={item.difference}
                  />
                  <Text style={styles.small}>
                    {item.difference_note} {item.notes}
                  </Text>
                  {item.transactions.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} zone={day.timezone} />
                  ))}
                </>
              )}
            </Card>
          ))}
          <Button
            title={showAudit ? 'Hide audit trail' : 'View audit trail'}
            secondary
            onPress={() => setShowAudit(!showAudit)}
          />
          {showAudit &&
            [...day.audit].reverse().map((event) => (
              <Card key={event.id}>
                <Text style={styles.heading}>{event.action.replaceAll('_', ' ')}</Text>
                <Text style={styles.small}>
                  {event.actor.name} ({event.actor.role}) · {timestamp(event.at, day.timezone)}
                </Text>
                <Text style={styles.label}>Before</Text>
                <AuditValues value={event.previous} />
                <Text style={styles.label}>After</Text>
                <AuditValues value={event.new} />
                {event.reason ? <Text style={styles.subtitle}>{event.reason}</Text> : null}
              </Card>
            ))}
        </>
      )}
    </Page>
  );
}
