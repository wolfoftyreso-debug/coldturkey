import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, type Dashboard } from '../src/api';
import { useSession } from '../src/session';
import { colors, styles } from '../src/theme';

/**
 * My recovery — the person's own plan.
 *
 * Their why statement first, because that is the thing the craving flow reaches
 * for, and it is worth nothing if it was never written.
 */
export default function PlanScreen() {
  const { t } = useSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const dashboard = await api.get<Dashboard>('/v1/dashboard');
      setData(dashboard);
      setWhy(dashboard.profile.whyStatement ?? '');
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      await api.put('/v1/me/profile', { whyStatement: why });
      setSaved(true);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t('mode.path')}</Text>

      {data?.phase ? (
        <View style={styles.card}>
          <Text style={styles.h3}>{data.phase.label}</Text>
          <Text style={styles.body}>{data.phase.reason}</Text>
          <View style={styles.row}>
            {data.phase.focus.map((focus) => (
              <View style={styles.chip} key={focus.key}>
                <Text style={styles.chipText}>{focus.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.h2}>{t('why.title').toUpperCase()}</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>{t('why.questions.cost')}</Text>
        <Text style={styles.muted}>{t('why.questions.who')}</Text>
        <TextInput
          style={[styles.input, { minHeight: 110, marginTop: 10 }]}
          value={why}
          onChangeText={setWhy}
          multiline
          placeholder={t('why.prompt')}
          placeholderTextColor={colors.textFaint}
        />
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => void save()}
          disabled={busy}
        >
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
            {saved ? t('checkin.saved') : t('action.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.h2}>{t('support.title').toUpperCase()}</Text>
      {data?.supportContacts.length ? (
        <View style={styles.card}>
          {data.supportContacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              onPress={() =>
                contact.phone
                  ? void Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`)
                  : undefined
              }
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.h3}>{contact.name}</Text>
                {contact.phone ? <Text style={styles.muted}>{t('action.call')}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>{t('support.empty')}</Text>
      )}

      <Text style={[styles.muted, { marginTop: 20 }]}>{t('support.noRequirement')}</Text>
    </ScrollView>
  );
}
