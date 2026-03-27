import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PLAY_HOTEL_LOGO = require('@/assets/icons/banditLocalpng.png');
const HERO_IMAGE = require('@/assets/images/play-psyri.jpg');

export default function HotelierScreen() {
  const insets = useSafeAreaInsets();
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!businessName.trim() || !city.trim() || !contactEmail.trim()) {
      Alert.alert('Missing fields', 'Add business name, city, and contact email.');
      return;
    }
    setSubmitted(true);
    Alert.alert(
      'Request received',
      `Thanks — we’ll email ${contactEmail.trim()} about PLAY Theatrou Athens guest access partnerships.`,
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Hotelier' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.logoBlock}>
          <Image source={PLAY_HOTEL_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>

        <Text style={styles.partnerLine}>PLAY Theatrou Athens - Local Insider Program</Text>
        <Text style={styles.bodyLead}>Turn your guests into explorers.</Text>
        <Text style={styles.body}>
          The PLAY guest flow connects travelers with curated local experiences designed for this property.
        </Text>

        <Text style={styles.sectionTitle}>Give your guests:</Text>
        <Text style={styles.bullet}>- insider recommendations</Text>
        <Text style={styles.bullet}>- hidden spots</Text>
        <Text style={styles.bullet}>- real local vibes</Text>

        <Text style={styles.sectionTitle}>And give your property:</Text>
        <Text style={styles.bullet}>- higher guest satisfaction</Text>
        <Text style={styles.bullet}>- shareable experiences</Text>
        <Text style={styles.bullet}>- a unique edge over other hotels</Text>

        <Text style={styles.body}>Tell us about your property to get started.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Business name</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Acropolis View Hotel"
            placeholderTextColor="#999"
            autoCapitalize="words"
          />

          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Athens"
            placeholderTextColor="#999"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Contact email</Text>
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="partners@yourbusiness.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={styles.submit} onPress={submit} activeOpacity={0.85}>
            <Text style={styles.submitText}>{submitted ? 'Submit again' : 'Submit partner request'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  heroImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 140,
    height: 44,
  },
  partnerLine: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 14,
  },
  bodyLead: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginTop: 4,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 2,
  },
  form: {
    gap: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  submit: {
    marginTop: 24,
    backgroundColor: '#E63946',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
