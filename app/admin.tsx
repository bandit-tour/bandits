import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { getBandits, updateBandit } from '@/app/services/bandits';
import { getEvents, updateEvent } from '@/app/services/events';
import { RequireAppAdminGate } from '@/components/RequireAppAdminGate';
import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type Event = Database['public']['Tables']['event']['Row'];

interface SearchResult {
  type: 'bandit' | 'event';
  item: Bandit | Event;
}

const AdminPageContent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'bandits' | 'events'>('bandits');
  const [bandits, setBandits] = useState<Bandit[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const filterResults = React.useCallback(() => {
    const query = searchQuery.toLowerCase().trim();
    let results: SearchResult[] = [];

    if (activeTab === 'bandits') {
      results = bandits
        .filter(bandit =>
          bandit.name.toLowerCase().includes(query) ||
          bandit.family_name.toLowerCase().includes(query) ||
          bandit.occupation.toLowerCase().includes(query) ||
          bandit.city.toLowerCase().includes(query)
        )
        .map(bandit => ({ type: 'bandit' as const, item: bandit }));
    } else {
      results = events
        .filter(event =>
          event.name.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.city.toLowerCase().includes(query) ||
          event.neighborhood.toLowerCase().includes(query)
        )
        .map(event => ({ type: 'event' as const, item: event }));
    }

    setFilteredResults(results);
  }, [searchQuery, activeTab, bandits, events]);

  useEffect(() => {
    filterResults();
  }, [filterResults]);

  const loadData = async () => {
    try {
      const [banditsData, eventsData] = await Promise.all([
        getBandits(),
        getEvents()
      ]);
      setBandits(banditsData);
      setEvents(eventsData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleItemPress = (result: SearchResult) => {
    setSelectedItem(result);
    setEditModalVisible(true);
  };

  const renderSearchResults = () => {
    return filteredResults.map((result, index) => (
      <TouchableOpacity
        key={`${result.type}-${result.item.id}`}
        style={styles.resultCard}
        onPress={() => handleItemPress(result)}
      >
        <Image
          source={{ uri: result.item.image_url }}
          style={styles.resultImage}
        />
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle}>
            {result.type === 'bandit'
              ? `${(result.item as Bandit).name} ${(result.item as Bandit).family_name}`
              : (result.item as Event).name
            }
          </Text>
          <Text style={styles.resultSubtitle}>
            {result.type === 'bandit'
              ? `${(result.item as Bandit).occupation} • Age ${(result.item as Bandit).age}`
              : (result.item as Event).genre
            }
          </Text>
          <Text style={styles.resultLocation}>
            {result.item.city}
          </Text>
        </View>
        <Text style={styles.resultType}>
          {result.type.toUpperCase()}
        </Text>
      </TouchableOpacity>
    ));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search bandits or events..."
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bandits' && styles.activeTab]}
            onPress={() => setActiveTab('bandits')}
          >
            <Text style={[styles.tabText, activeTab === 'bandits' && styles.activeTabText]}>
              Bandits ({bandits.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.activeTab]}
            onPress={() => setActiveTab('events')}
          >
            <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
              Events ({events.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
        {filteredResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No results found' : `No ${activeTab} available`}
            </Text>
          </View>
        ) : (
          renderSearchResults()
        )}
      </ScrollView>

      {selectedItem && (
        <EditModal
          visible={editModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
          onSave={() => {
            loadData();
            setEditModalVisible(false);
            setSelectedItem(null);
          }}
        />
      )}
    </View>
  );
};

interface EditModalProps {
  visible: boolean;
  onClose: () => void;
  item: SearchResult;
  onSave: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ visible, onClose, item, onSave }) => {
  const [formData, setFormData] = useState<any>({});
  const [selectedMainImage, setSelectedMainImage] = useState<string | null>(null);
  const [selectedFaceImage, setSelectedFaceImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOverMain, setDragOverMain] = useState(false);
  const [dragOverFace, setDragOverFace] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({ ...item.item });
      setSelectedMainImage(null);
      setSelectedFaceImage(null);
    }
  }, [item]);

  const pickMainImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedMainImage(result.assets[0].uri);
    }
  };

  const pickFaceImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedFaceImage(result.assets[0].uri);
    }
  };

  const handleMainDrop = (e: any) => {
    e.preventDefault();
    setDragOverMain(false);

    if (Platform.OS !== 'web') return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setSelectedMainImage(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      } else {
        Alert.alert('Error', 'Please select an image file');
      }
    }
  };

  const handleFaceDrop = (e: any) => {
    e.preventDefault();
    setDragOverFace(false);

    if (Platform.OS !== 'web') return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setSelectedFaceImage(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      } else {
        Alert.alert('Error', 'Please select an image file');
      }
    }
  };

  const handleMainDragOver = (e: any) => {
    e.preventDefault();
    setDragOverMain(true);
  };

  const handleMainDragLeave = (e: any) => {
    e.preventDefault();
    setDragOverMain(false);
  };

  const handleFaceDragOver = (e: any) => {
    e.preventDefault();
    setDragOverFace(true);
  };

  const handleFaceDragLeave = (e: any) => {
    e.preventDefault();
    setDragOverFace(false);
  };

  const uploadMainImage = async (): Promise<string> => {
    if (!selectedMainImage) return formData.image_url;

    const filename = `${item.type}_${item.item.id}_${Date.now()}.jpg`;

    let fileToUpload;

    if (Platform.OS === 'web' && selectedMainImage.startsWith('data:')) {
      // Convert base64 to blob for web drag & drop
      const response = await fetch(selectedMainImage);
      fileToUpload = await response.blob();
    } else {
      // For mobile image picker
      const formDataUpload = new FormData();
      formDataUpload.append('file', {
        uri: selectedMainImage,
        type: 'image/jpeg',
        name: filename,
      } as any);
      fileToUpload = formDataUpload;
    }

    const { data, error } = await supabase.storage
      .from('profile_avatars')
      .upload(filename, fileToUpload, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('profile_avatars')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const uploadFaceImage = async (): Promise<string | null> => {
    if (!selectedFaceImage) return formData.face_image_url;

    // Extract the filename from the main image URL and use it for face image
    const mainImageUrl = formData.image_url;
    const urlParts = mainImageUrl.split('/');
    const originalFilename = urlParts[urlParts.length - 1];
    const filename = `face_images/${originalFilename}`;

    let fileToUpload;

    if (Platform.OS === 'web' && selectedFaceImage.startsWith('data:')) {
      // Convert base64 to blob for web drag & drop
      const response = await fetch(selectedFaceImage);
      fileToUpload = await response.blob();
    } else {
      // For mobile image picker
      const formDataUpload = new FormData();
      formDataUpload.append('file', {
        uri: selectedFaceImage,
        type: 'image/jpeg',
        name: filename,
      } as any);
      fileToUpload = formDataUpload;
    }

    const { data, error } = await supabase.storage
      .from('profile_avatars')
      .upload(filename, fileToUpload, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('profile_avatars')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSave = async () => {
    try {
      setUploading(true);

      console.log('Updating item:', item.type, 'with ID:', item.item.id);
      console.log('Form data:', formData);

      let imageUrl = formData.image_url;
      let faceImageUrl = formData.face_image_url;

      if (selectedMainImage) {
        imageUrl = await uploadMainImage();
      }

      if (selectedFaceImage && item.type === 'bandit') {
        faceImageUrl = await uploadFaceImage();
      }

      if (item.type === 'bandit') {
        const banditUpdate = {
          name: formData.name,
          family_name: formData.family_name,
          age: parseInt(formData.age) || 0,
          city: formData.city,
          occupation: formData.occupation,
          image_url: imageUrl,
          face_image_url: faceImageUrl,
          rating: parseInt(formData.rating) || 0,
          is_liked: formData.is_liked,
          icon: formData.icon,
          description: formData.description,
          why_follow: formData.why_follow,
        };
        console.log('Bandit update data:', banditUpdate);
        await updateBandit(item.item.id, banditUpdate);
      } else {
        const eventUpdate = {
          name: formData.name,
          genre: formData.genre,
          start_time: formData.start_time,
          end_time: formData.end_time,
          timing_info: formData.timing_info,
          location_lat: parseFloat(formData.location_lat) || 0,
          location_lng: parseFloat(formData.location_lng) || 0,
          address: formData.address,
          city: formData.city,
          neighborhood: formData.neighborhood,
          description: formData.description,
          rating: parseInt(formData.rating) || 0,
          image_url: imageUrl,
          link: formData.link,
          image_gallery: formData.image_gallery,
        };
        console.log('Event update data:', eventUpdate);
        await updateEvent(item.item.id, eventUpdate);
      }

      Alert.alert('Success', `${item.type} updated successfully`);
      onSave();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to update ${item.type}: ${msg}`);
      console.error('Error updating item:', error);
    } finally {
      setUploading(false);
    }
  };

  const renderFormFields = () => {
    if (item.type === 'bandit') {
      return (
        <>
          <FormField label="Name" value={formData.name} onChangeText={(text) => setFormData({...formData, name: text})} />
          <FormField label="Family Name" value={formData.family_name} onChangeText={(text) => setFormData({...formData, family_name: text})} />
          <FormField label="Age" value={formData.age?.toString()} onChangeText={(text) => setFormData({...formData, age: parseInt(text) || 0})} keyboardType="numeric" />
          <FormField label="City" value={formData.city} onChangeText={(text) => setFormData({...formData, city: text})} />
          <FormField label="Occupation" value={formData.occupation} onChangeText={(text) => setFormData({...formData, occupation: text})} />
          <FormField label="Rating" value={formData.rating?.toString()} onChangeText={(text) => setFormData({...formData, rating: parseFloat(text) || 0})} keyboardType="numeric" />
          <FormField label="Description" value={formData.description} onChangeText={(text) => setFormData({...formData, description: text})} multiline />
          <FormField label="Why Follow" value={formData.why_follow} onChangeText={(text) => setFormData({...formData, why_follow: text})} multiline />
          <FormField label="Icon" value={formData.icon} onChangeText={(text) => setFormData({...formData, icon: text})} />
          <FormField label="Face Image URL" value={formData.face_image_url} onChangeText={(text) => setFormData({...formData, face_image_url: text})} />
        </>
      );
    } else {
      return (
        <>
          <FormField label="Name" value={formData.name} onChangeText={(text) => setFormData({...formData, name: text})} />
          <FormField label="Genre" value={formData.genre} onChangeText={(text) => setFormData({...formData, genre: text})} />
          <FormField label="Start Time" value={formData.start_time} onChangeText={(text) => setFormData({...formData, start_time: text})} />
          <FormField label="End Time" value={formData.end_time} onChangeText={(text) => setFormData({...formData, end_time: text})} />
          <FormField label="Timing Info" value={formData.timing_info} onChangeText={(text) => setFormData({...formData, timing_info: text})} />
          <FormField label="Address" value={formData.address} onChangeText={(text) => setFormData({...formData, address: text})} />
          <FormField label="City" value={formData.city} onChangeText={(text) => setFormData({...formData, city: text})} />
          <FormField label="Neighborhood" value={formData.neighborhood} onChangeText={(text) => setFormData({...formData, neighborhood: text})} />
          <FormField label="Description" value={formData.description} onChangeText={(text) => setFormData({...formData, description: text})} multiline />
          <FormField label="Rating" value={formData.rating?.toString()} onChangeText={(text) => setFormData({...formData, rating: parseFloat(text) || 0})} keyboardType="numeric" />
          <FormField label="Link" value={formData.link} onChangeText={(text) => setFormData({...formData, link: text})} />
          <FormField label="Location Lat" value={formData.location_lat?.toString()} onChangeText={(text) => setFormData({...formData, location_lat: parseFloat(text) || 0})} keyboardType="numeric" />
          <FormField label="Location Lng" value={formData.location_lng?.toString()} onChangeText={(text) => setFormData({...formData, location_lng: parseFloat(text) || 0})} keyboardType="numeric" />
        </>
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            Edit {item.type === 'bandit' ? 'Bandit' : 'Event'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.modalSaveButton}
            disabled={uploading}
          >
            <Text style={styles.modalSaveText}>
              {uploading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Main Image Upload */}
          <Text style={styles.imageLabel}>Main Image</Text>
          <View
            style={[
              styles.imageContainer,
              dragOverMain && Platform.OS === 'web' && styles.imageContainerDragOver
            ]}
          >
            <TouchableOpacity onPress={pickMainImage} style={styles.imageWrapper}>
              <Image
                source={{ uri: selectedMainImage || formData.image_url }}
                style={styles.modalImage}
              />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageOverlayText}>
                  {Platform.OS === 'web'
                    ? (dragOverMain ? 'Drop main image here' : 'Tap to change main image or drag & drop')
                    : 'Tap to change main image'
                  }
                </Text>
              </View>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <input
                type="file"
                accept="image/*"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        setSelectedMainImage(event.target.result as string);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                onDrop={handleMainDrop}
                onDragOver={handleMainDragOver}
                onDragLeave={handleMainDragLeave}
              />
            )}
          </View>

          {/* Face Image Upload (only for bandits) */}
          {item.type === 'bandit' && (
            <>
              <Text style={styles.imageLabel}>Face Image (for cards)</Text>
              <View
                style={[
                  styles.imageContainer,
                  dragOverFace && Platform.OS === 'web' && styles.imageContainerDragOver
                ]}
              >
                <TouchableOpacity onPress={pickFaceImage} style={styles.imageWrapper}>
                  <Image
                    source={{ uri: selectedFaceImage || formData.face_image_url || formData.image_url }}
                    style={styles.modalImage}
                  />
                  <View style={styles.imageOverlay}>
                    <Text style={styles.imageOverlayText}>
                      {Platform.OS === 'web'
                        ? (dragOverFace ? 'Drop face image here' : 'Tap to change face image or drag & drop')
                        : 'Tap to change face image'
                      }
                    </Text>
                  </View>
                </TouchableOpacity>
                {Platform.OS === 'web' && (
                  <input
                    type="file"
                    accept="image/*"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setSelectedFaceImage(event.target.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onDrop={handleFaceDrop}
                    onDragOver={handleFaceDragOver}
                    onDragLeave={handleFaceDragLeave}
                  />
                )}
              </View>
            </>
          )}

          {renderFormFields()}
        </ScrollView>
      </View>
    </Modal>
  );
};

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = 'default'
}) => (
  <View style={styles.formField}>
    <Text style={styles.formLabel}>{label}</Text>
    <TextInput
      style={[styles.formInput, multiline && styles.formInputMultiline]}
      value={value || ''}
      onChangeText={onChangeText}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f1f3f4',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f4',
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  resultLocation: {
    fontSize: 12,
    color: '#999',
  },
  resultType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  modalCloseButton: {
    paddingVertical: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalSaveButton: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  imageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 4,
  },
  imageWrapper: {
    position: 'relative',
  },
  imageContainerDragOver: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  modalImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default function AdminScreen() {
  return (
    <RequireAppAdminGate>
      <AdminPageContent />
    </RequireAppAdminGate>
  );
}