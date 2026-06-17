import Foundation
import Capacitor
import MapKit

@objc(StoreSearch)
public class StoreSearch: CAPPlugin {
    @objc func search(_ call: CAPPluginCall) {
        let queries = call.getArray("queries", String.self) ?? []
        let lat = call.getDouble("lat") ?? 0
        let lng = call.getDouble("lng") ?? 0
        let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        let region = MKCoordinateRegion(center: center,
            latitudinalMeters: 8000, longitudinalMeters: 8000)

        let group = DispatchGroup()
        var collected: [[String: Any]] = []
        let lock = NSLock()

        for term in queries {
            group.enter()
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = term
            request.region = region
            MKLocalSearch(request: request).start { response, _ in
                defer { group.leave() }
                guard let items = response?.mapItems else { return }
                lock.lock()
                for item in items.prefix(10) {
                    let p = item.placemark
                    collected.append([
                        "name": item.name ?? "",
                        "lat": p.coordinate.latitude,
                        "lng": p.coordinate.longitude,
                        "address": [p.thoroughfare, p.locality].compactMap { $0 }.joined(separator: " "),
                        "matchedTerm": term,
                        "category": item.pointOfInterestCategory?.rawValue ?? ""
                    ])
                }
                lock.unlock()
            }
        }

        group.notify(queue: .main) {
            call.resolve(["results": collected])
        }
    }
}
