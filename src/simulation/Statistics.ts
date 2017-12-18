export default class Statistics {
  public totalEvents: number = 0;
  public maxTimestampMs: number = 0;
  public totalWarnings: number = 0;
  public totalErrors: number = 0;
  public totalSentMessages: number = 0;
  public totalReceivedMessagesPerNode: number[] = [];
  public totalSentBytes: number = 0;
  public totalBroadcasts: number = 0;
  public totalUnicasts: number = 0;
}
