import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, colors, styles } from './ui';

export function RegisterCalendar({
  month,
  today,
  selected,
  onSelect,
}: {
  month: string;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const [year, number] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return (
    <Card>
      <Text style={styles.small}>
        Choose a date to see the whole team’s register. The gold outline marks today.
      </Text>
      <View style={{ flexDirection: 'row' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
          <Text key={index} style={[styles.small, { width: '14.2857%', textAlign: 'center' }]}>
            {label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
          const number = index - offset + 1;
          const date = `${month}-${String(number).padStart(2, '0')}`;
          const future = date > today;
          return (
            <View key={index} style={{ width: '14.2857%', padding: 2 }}>
              {number > 0 && number <= count && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Team attendance ${date}${date === today ? ', Today' : ''}`}
                  accessibilityState={{ selected: selected === date, disabled: future }}
                  disabled={future}
                  onPress={() => onSelect(date)}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 10,
                    backgroundColor: selected === date ? colors.green : colors.mint,
                    borderWidth: 2,
                    borderColor: date === today ? colors.gold : 'transparent',
                    opacity: future ? 0.35 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: '600',
                      color: selected === date ? colors.white : colors.ink,
                    }}
                  >
                    {number}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}
