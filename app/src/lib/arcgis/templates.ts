import PopupTemplate from "@arcgis/core/PopupTemplate";

export const CloudCoverPopupTemplate = new PopupTemplate({
  title: "{cloudCover}% cloud cover",
  content: `
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px;"><b>Latitude</b></td>
        <td style="padding: 4px;">{lat}</td>
      </tr>
      <tr>
        <td style="padding: 4px;"><b>Longitude</b></td>
        <td style="padding: 4px;">{lon}</td>
      </tr>
      <tr>
        <td style="padding: 4px;"><b>Observed</b></td>
        <td style="padding: 4px;">{time} UTC</td>
      </tr>
    </table>
  `,
});
