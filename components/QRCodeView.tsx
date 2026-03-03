import React from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";

type QRCodeViewProps = {
  data: string;
  size?: number;
};

export default function QRCodeView({ data, size = 220 }: QRCodeViewProps) {
  return (
    <View>
      <QRCode value={data} size={size} />
    </View>
  );
}
